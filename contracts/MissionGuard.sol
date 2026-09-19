// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice Task-scoped, non-upgradeable ERC20 escrow. No platform withdrawal key.
/// @dev Grant limits are shared cumulative ceilings, NOT reserved balances.
/// Every ancestor is checked and charged atomically on each successful payment.
contract MissionGuard is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    uint256 public missionCount;
    uint256 public grantCount;
    uint8 public constant MAX_DEPTH = 8;
    bytes32 public constant PAYMENT_TYPEHASH = keccak256("Payment(uint256 missionId,uint256 grantId,address recipient,uint256 amount,bytes32 requestId,uint64 deadline,uint64 epoch)");

    struct Mission {
        address owner;
        uint256 budget;
        uint256 spent;
        uint256 withdrawn;
        uint64 expiresAt;
        uint64 epoch;
        bool revoked;
        bytes32 specHash;
    }
    struct Grant {
        uint256 missionId;
        uint256 parentId;
        address agent;
        uint256 limit;
        uint256 spent;
        uint256 maxPerPayment;
        uint64 expiresAt;
        uint8 depth;
        bool revoked;
    }
    struct Payment {
        uint256 missionId;
        uint256 grantId;
        address recipient;
        uint256 amount;
        bytes32 requestId;
        uint64 deadline;
        uint64 epoch;
    }
    mapping(uint256 => Mission) public missions;
    mapping(uint256 => Grant) public grants;
    mapping(uint256 => mapping(address => bool)) public merchants;
    mapping(uint256 => mapping(bytes32 => bool)) public usedRequests;

    error Unauthorized();
    error InvalidInput();
    error MissionInactive();
    error GrantInactive();
    error StalePolicy();
    error SignatureExpired();
    error InvalidSignature();
    error MerchantDenied();
    error RequestAlreadyUsed();
    error MissionBudgetExceeded();
    error GrantBudgetExceeded(uint256 grantId);
    error PerPaymentExceeded(uint256 grantId);
    error UnsupportedToken();
    error WithdrawalNotAvailable();

    event MissionCreated(uint256 indexed missionId, address indexed owner, uint256 budget, uint64 expiresAt, bytes32 specHash);
    event GrantCreated(uint256 indexed missionId, uint256 indexed grantId, uint256 indexed parentId, address agent, uint256 limit, uint256 maxPerPayment);
    event MerchantUpdated(uint256 indexed missionId, address indexed merchant, bool allowed, uint64 epoch);
    event PaymentExecuted(uint256 indexed missionId, uint256 indexed grantId, bytes32 indexed requestId, address recipient, uint256 amount, bytes32 paymentHash);
    event MissionRevoked(uint256 indexed missionId, uint64 epoch);
    event GrantRevoked(uint256 indexed missionId, uint256 indexed grantId);
    event RemainderWithdrawn(uint256 indexed missionId, address indexed owner, uint256 amount);

    constructor(address token_) EIP712("MissionGuard", "1") {
        if (token_.code.length == 0) revert InvalidInput();
        token = IERC20(token_);
    }

    function createMission(uint256 budget, uint64 expiresAt, bytes32 specHash) external nonReentrant returns (uint256 id) {
        if (budget == 0 || expiresAt <= block.timestamp) revert InvalidInput();
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), budget);
        if (token.balanceOf(address(this)) - beforeBalance != budget) revert UnsupportedToken();
        id = ++missionCount;
        missions[id] = Mission(msg.sender, budget, 0, 0, expiresAt, 1, false, specHash);
        emit MissionCreated(id, msg.sender, budget, expiresAt, specHash);
    }

    function setMerchant(uint256 missionId, address merchant, bool allowed) external {
        Mission storage m = missions[missionId];
        _owner(m);
        _active(m);
        if (merchant == address(0) || merchant == address(this)) revert InvalidInput();
        merchants[missionId][merchant] = allowed;
        // Policy changes invalidate ALL previously signed payments for this mission.
        ++m.epoch;
        emit MerchantUpdated(missionId, merchant, allowed, m.epoch);
    }

    function createGrant(uint256 missionId, uint256 parentId, address agent, uint256 limit, uint256 maxPerPayment, uint64 expiresAt) external returns (uint256 id) {
        Mission storage m = missions[missionId];
        _active(m);
        if (agent == address(0) || limit == 0 || maxPerPayment == 0 || maxPerPayment > limit || expiresAt <= block.timestamp || expiresAt > m.expiresAt || limit > m.budget) revert InvalidInput();
        uint8 depth = 1;
        if (parentId == 0) {
            _owner(m);
        } else {
            Grant storage parent = grants[parentId];
            if (parent.missionId != missionId) revert InvalidInput();
            if (msg.sender != m.owner && msg.sender != parent.agent) revert Unauthorized();
            if (limit > parent.limit || maxPerPayment > parent.maxPerPayment || expiresAt > parent.expiresAt) revert InvalidInput();
            depth = parent.depth + 1;
            if (depth > MAX_DEPTH) revert InvalidInput();
            uint256 cursor = parentId;
            while (cursor != 0) {
                Grant storage ancestor = grants[cursor];
                if (ancestor.revoked || block.timestamp >= ancestor.expiresAt) revert GrantInactive();
                cursor = ancestor.parentId;
            }
        }
        id = ++grantCount;
        grants[id] = Grant(missionId, parentId, agent, limit, 0, maxPerPayment, expiresAt, depth, false);
        emit GrantCreated(missionId, id, parentId, agent, limit, maxPerPayment);
    }

    function paymentDigest(Payment calldata p) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(PAYMENT_TYPEHASH, p.missionId, p.grantId, p.recipient, p.amount, p.requestId, p.deadline, p.epoch)));
    }

    /// @notice Anyone can relay an agent-signed payment; only the bound recipient receives funds.
    function executePayment(Payment calldata p, bytes calldata signature) external nonReentrant {
        Mission storage m = missions[p.missionId];
        _active(m);
        if (p.deadline <= block.timestamp) revert SignatureExpired();
        if (p.epoch != m.epoch) revert StalePolicy();
        if (p.amount == 0 || p.requestId == bytes32(0)) revert InvalidInput();
        Grant storage leaf = grants[p.grantId];
        if (leaf.missionId != p.missionId || leaf.agent == address(0)) revert InvalidInput();
        if (!merchants[p.missionId][p.recipient]) revert MerchantDenied();
        if (usedRequests[p.missionId][p.requestId]) revert RequestAlreadyUsed();
        if (p.amount > m.budget - m.spent - m.withdrawn) revert MissionBudgetExceeded();
        bytes32 digest = paymentDigest(p);
        if (!SignatureChecker.isValidSignatureNow(leaf.agent, digest, signature)) revert InvalidSignature();
        uint256 cursor = p.grantId;
        while (cursor != 0) {
            Grant storage g = grants[cursor];
            if (g.revoked || block.timestamp >= g.expiresAt) revert GrantInactive();
            if (p.amount > g.maxPerPayment) revert PerPaymentExceeded(cursor);
            if (p.amount > g.limit - g.spent) revert GrantBudgetExceeded(cursor);
            g.spent += p.amount;
            cursor = g.parentId;
        }
        usedRequests[p.missionId][p.requestId] = true;
        m.spent += p.amount;
        token.safeTransfer(p.recipient, p.amount);
        emit PaymentExecuted(p.missionId, p.grantId, p.requestId, p.recipient, p.amount, digest);
    }

    function revokeMission(uint256 missionId) external {
        Mission storage m = missions[missionId];
        _owner(m);
        if (m.revoked) revert MissionInactive();
        m.revoked = true;
        ++m.epoch;
        emit MissionRevoked(missionId, m.epoch);
    }

    /// @notice Mission owner or direct parent agent can revoke a grant and all descendants.
    function revokeGrant(uint256 grantId) external {
        Grant storage g = grants[grantId];
        Mission storage m = missions[g.missionId];
        if (m.owner == address(0) || (msg.sender != m.owner && (g.parentId == 0 || msg.sender != grants[g.parentId].agent))) revert Unauthorized();
        if (g.revoked) revert GrantInactive();
        g.revoked = true;
        emit GrantRevoked(g.missionId, grantId);
    }

    function withdrawRemainder(uint256 missionId) external nonReentrant {
        Mission storage m = missions[missionId];
        _owner(m);
        if (!m.revoked && block.timestamp < m.expiresAt) revert WithdrawalNotAvailable();
        uint256 remaining = m.budget - m.spent - m.withdrawn;
        if (remaining == 0) revert WithdrawalNotAvailable();
        m.withdrawn += remaining;
        token.safeTransfer(m.owner, remaining);
        emit RemainderWithdrawn(missionId, m.owner, remaining);
    }

    function remainingBudget(uint256 missionId) external view returns (uint256) {
        Mission storage m = missions[missionId];
        return m.budget - m.spent - m.withdrawn;
    }
    function _owner(Mission storage m) internal view { if (m.owner != msg.sender) revert Unauthorized(); }
    function _active(Mission storage m) internal view { if (m.owner == address(0) || m.revoked || block.timestamp >= m.expiresAt) revert MissionInactive(); }
}
