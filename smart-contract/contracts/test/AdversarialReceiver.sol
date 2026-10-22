// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../Crowdfunding.sol";

/// @dev Local adversarial receiver; never included in the deployment module.
contract AdversarialReceiver {
    Crowdfunding public immutable target;
    uint256 public campaignId;
    bool public rejectPayment;
    bool public refundMode;
    bool public reentrySucceeded;

    constructor(Crowdfunding target_) { target = target_; }
    function create(uint256 goal, uint256 deadline) external {
        campaignId = target.createCampaign("Receiver", "", goal, deadline, 0);
    }
    function donate(uint256 id) external payable {
        campaignId = id;
        target.contribute{value: msg.value}(id);
    }
    function collect(bool refund_, bool reject_) external {
        refundMode = refund_;
        rejectPayment = reject_;
        if (refund_) target.refund(campaignId);
        else target.withdraw(campaignId);
    }
    receive() external payable {
        require(!rejectPayment, "Receiver rejects");
        bytes memory data = refundMode
            ? abi.encodeCall(target.refund, (campaignId))
            : abi.encodeCall(target.withdraw, (campaignId));
        (bool success, bytes memory reason) = address(target).call(data);
        reentrySucceeded = success;
        require(!success && keccak256(reason) == keccak256(abi.encodeWithSignature("Error(string)", "Reentrant call")), "Expected reentrancy guard");
    }
}
