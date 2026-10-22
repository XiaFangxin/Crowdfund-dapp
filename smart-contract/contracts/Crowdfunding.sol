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

    struct Category {
        string name;
        bool active;
    }

    uint256 public constant MAX_CATEGORY_NAME_LENGTH = 64;
    uint256 public categoryCount;
    mapping(uint256 => Category) private categories;
    mapping(uint256 => uint256) private campaignCategories;

    event CategoryAdded(uint256 indexed categoryId, string name);
    event CategoryRenamed(uint256 indexed categoryId, string previousName, string newName);
    event CategoryStatusChanged(uint256 indexed categoryId, bool active);
    event CampaignCategoryAssigned(uint256 indexed campaignId, uint256 indexed categoryId);

    // Administration governs new donations and the category registry, never custody.
    address public owner;
    address public pendingOwner;
    uint256 public constant MAX_URI_LENGTH = 2048;
    mapping(uint256 => bool) public campaignPaused;
    mapping(uint256 => string) private metadataURIs;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CampaignPauseChanged(uint256 indexed campaignId, bool paused);
    event CampaignMetadataUpdated(uint256 indexed campaignId, string metadataURI);
    event CampaignUpdatePublished(uint256 indexed campaignId, address indexed creator, string updateURI);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        _addCategory("Education");
        _addCategory("Charity");
        _addCategory("Technology");
        _addCategory("Creative");
        _addCategory("Environment");
        _addCategory("Community");
    }

    modifier validCategory(uint256 categoryId) {
        require(categoryId < categoryCount, "Category not found");
        _;
    }

    function getCategory(uint256 categoryId) external view validCategory(categoryId) returns (Category memory) {
        return categories[categoryId];
    }

    function getCampaignCategoryId(uint256 campaignId) external view validCampaign(campaignId) returns (uint256) {
        return campaignCategories[campaignId];
    }

    function addCategory(string calldata name) external onlyOwner returns (uint256 categoryId) {
        return _addCategory(name);
    }

    function renameCategory(uint256 categoryId, string calldata name) external onlyOwner validCategory(categoryId) {
        validateCategoryName(name);
        string memory previousName = categories[categoryId].name;
        require(keccak256(bytes(previousName)) != keccak256(bytes(name)), "Name unchanged");
        categories[categoryId].name = name;
        emit CategoryRenamed(categoryId, previousName, name);
    }

    function setCategoryActive(uint256 categoryId, bool active) external onlyOwner validCategory(categoryId) {
        require(categories[categoryId].active != active, "Category status unchanged");
        categories[categoryId].active = active;
        emit CategoryStatusChanged(categoryId, active);
    }

    function _addCategory(string memory name) private returns (uint256 categoryId) {
        validateCategoryName(name);
        categoryId = categoryCount++;
        categories[categoryId] = Category(name, true);
        emit CategoryAdded(categoryId, name);
    }

    // Bounded printable ASCII; internal spaces allowed, surrounding spaces rejected.
    // Names are display labels, not unique keys. IDs alone define category identity.
    function validateCategoryName(string memory name) private pure {
        bytes memory value = bytes(name);
        require(value.length > 0 && value.length <= MAX_CATEGORY_NAME_LENGTH, "Invalid category name length");
        require(value[0] != 0x20 && value[value.length - 1] != 0x20, "Invalid category name");
        for (uint256 i = 0; i < value.length; i++) {
            require(uint8(value[i]) >= 32 && uint8(value[i]) < 127, "Invalid category name");
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyCreator(uint256 campaignId) {
        require(msg.sender == campaigns[campaignId].creator, "Only creator");
        _;
    }

    // Two-step transfer prevents an incorrect address immediately taking ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0) && newOwner != owner, "Invalid owner");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Only pending owner");
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, owner);
    }

    function setCampaignPaused(uint256 campaignId, bool paused) external onlyOwner validCampaign(campaignId) {
        require(campaignPaused[campaignId] != paused, "Pause unchanged");
        campaignPaused[campaignId] = paused;
        emit CampaignPauseChanged(campaignId, paused);
    }

    function getCampaignMetadataURI(uint256 campaignId) external view validCampaign(campaignId) returns (string memory) {
        return metadataURIs[campaignId];
    }

    function setCampaignMetadataURI(uint256 campaignId, string calldata uri)
        external validCampaign(campaignId) onlyCreator(campaignId)
    {
        validateURI(uri);
        metadataURIs[campaignId] = uri;
        emit CampaignMetadataUpdated(campaignId, uri);
    }

    // Event-only history: clients order by block, transaction index, and log index.
    function publishCampaignUpdate(uint256 campaignId, string calldata uri)
        external validCampaign(campaignId) onlyCreator(campaignId)
    {
        validateURI(uri);
        emit CampaignUpdatePublished(campaignId, msg.sender, uri);
    }

    // Restrict to printable ASCII IPFS/HTTPS pointers, not inline content.
    // Content validity, availability and JSON schema are verified off chain.
    function validateURI(string calldata uri) private pure {
        bytes memory value = bytes(uri);
        require(value.length > 0 && value.length <= MAX_URI_LENGTH, "Invalid URI length");
        bool ipfs = value.length > 7 && bytes7(value) == bytes7("ipfs://");
        bool https = value.length > 8 && bytes8(value) == bytes8("https://");
        require(ipfs || https, "Unsupported URI");
        for (uint256 i = 0; i < value.length; i++) {
            require(uint8(value[i]) > 32 && uint8(value[i]) < 127, "Invalid URI character");
        }
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

    function createCampaign(string calldata title, string calldata description, uint256 goal, uint256 deadline, uint256 categoryId)
        external validCategory(categoryId) returns (uint256 campaignId)
    {
        require(categories[categoryId].active, "Category inactive");
        require(bytes(title).length > 0, "Title required");
        require(goal > 0, "Goal must be positive");
        require(deadline > block.timestamp, "Deadline must be in future");
        campaignId = campaignCount++;
        campaigns[campaignId] = Campaign(msg.sender, title, description, goal, deadline, 0, false);
        campaignCategories[campaignId] = categoryId;
        emit CampaignCreated(campaignId, msg.sender, title, goal, deadline);
        emit CampaignCategoryAssigned(campaignId, categoryId);
    }

    function getCampaign(uint256 campaignId) external view validCampaign(campaignId) returns (Campaign memory) {
        return campaigns[campaignId];
    }

    function contribute(uint256 campaignId) external payable validCampaign(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(!campaignPaused[campaignId], "Campaign paused");
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
