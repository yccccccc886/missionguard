// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {DemoUSD} from "../DemoUSD.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
contract SwitchToken is DemoUSD {
    bool public fail;
    bool public attack;
    address public target;
    bytes public payload;
    function setFail(bool value) external { fail=value; }
    function arm(address target_, bytes calldata payload_) external { target=target_; payload=payload_; attack=true; }
    function transfer(address to,uint256 amount) public override returns(bool) {
        if(fail) return false;
        if(attack) { attack=false; (bool success,)=target.call(payload); require(!success,"reentrancy succeeded"); }
        return super.transfer(to,amount);
    }
}
contract ContractAgent is IERC1271 {
    address public immutable signer;
    constructor(address signer_) { signer=signer_; }
    function isValidSignature(bytes32 digest,bytes memory signature) external view returns(bytes4) {
        return ECDSA.recover(digest,signature)==signer ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}
