// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Educational crowdfunding demo. Deadlines are Unix seconds; values are wei.
contract Crowdfunding {
    struct Campaign {
        address creator;
        string title;
        string description;
        uint256 goal;
        uint256 deadline;
        uint256 amountRaised; // Historical total, unchanged by payouts/refunds.
        bool withdrawn;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) private campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    bool private locked;

    event CampaignCreated(uint256 indexed campaignId, address indexed creator, string title, uint256 goal, uint256 deadline);
    event Contributed(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event Withdrawn(uint256 indexed campaignId, address indexed creator, uint256 amount);
    event Refunded(uint256 indexed campaignId, address indexed contributor, uint256 amount);

    modifier validCampaign(uint256 campaignId) {
        require(campaignId < campaignCount, "Campaign not found");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function createCampaign(string calldata title, string calldata description, uint256 goal, uint256 deadline)
        external returns (uint256 campaignId)
    {
        require(bytes(title).length > 0, "Title required");
        require(goal > 0, "Goal must be positive");
        require(deadline > block.timestamp, "Deadline must be in future");
        campaignId = campaignCount++;
        campaigns[campaignId] = Campaign(msg.sender, title, description, goal, deadline, 0, false);
        emit CampaignCreated(campaignId, msg.sender, title, goal, deadline);
    }

    function getCampaign(uint256 campaignId) external view validCampaign(campaignId) returns (Campaign memory) {
        return campaigns[campaignId];
    }

    function contribute(uint256 campaignId) external payable validCampaign(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(msg.value > 0, "Contribution must be positive");
        contributions[campaignId][msg.sender] += msg.value;
        campaign.amountRaised += msg.value;
        emit Contributed(campaignId, msg.sender, msg.value);
    }

    function withdraw(uint256 campaignId) external validCampaign(campaignId) nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        require(msg.sender == campaign.creator, "Only creator");
        require(block.timestamp >= campaign.deadline, "Campaign still active");
        require(campaign.amountRaised >= campaign.goal, "Goal not reached");
        require(!campaign.withdrawn, "Already withdrawn");
        campaign.withdrawn = true;
        // Update state before transferring ETH. A failed transfer reverts the state update.
        (bool sent, ) = payable(campaign.creator).call{value: campaign.amountRaised}("");
        require(sent, "Transfer failed");
        emit Withdrawn(campaignId, campaign.creator, campaign.amountRaised);
    }

    function refund(uint256 campaignId) external validCampaign(campaignId) nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        require(block.timestamp >= campaign.deadline, "Campaign still active");
        require(campaign.amountRaised < campaign.goal, "Goal reached");
        uint256 amount = contributions[campaignId][msg.sender];
        require(amount > 0, "Nothing to refund");
        contributions[campaignId][msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
        emit Refunded(campaignId, msg.sender, amount);
    }
}
