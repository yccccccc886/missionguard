// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @notice Test-only faucet token. This is NOT Circle USDC. Mintable by anyone.
contract DemoUSD is ERC20 {
    constructor() ERC20("MissionGuard Demo Dollar", "DemoUSD") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
