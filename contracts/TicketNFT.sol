// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin provides a widely used, audited implementation of ERC-721.
// Remix downloads this npm dependency automatically when the contract compiles.
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title TicketNFT
 * @notice A free event ticket where each wallet can mint exactly one NFT.
 *
 * ERC-721 is the Ethereum standard for non-fungible tokens. Unlike interchangeable
 * ERC-20 tokens, every ERC-721 token has a unique token ID and a single owner.
 * Inheriting ERC721 gives this contract standard functions such as ownerOf,
 * balanceOf, safeTransferFrom, and the Transfer event.
 */
contract TicketNFT is ERC721 {
    // Token IDs start at 1 because that is easier to recognize in block explorers.
    uint256 private _nextTokenId = 1;

    // A public mapping stores whether an address has already claimed a ticket.
    // Solidity automatically creates a read-only hasMinted(address) getter.
    mapping(address => bool) public hasMinted;

    // This app-specific event makes successful mints easy to find off-chain.
    // ERC721 also emits its standard Transfer event whenever _safeMint succeeds.
    event Mint(address indexed minter, uint256 indexed tokenId);

    // The two strings are the collection name and ticker symbol shown by wallets.
    constructor() ERC721("Ticket NFT", "TICKET") {}

    /**
     * @notice Mint one ticket to the wallet that sends the transaction.
     * @return tokenId The unique ID assigned to the new ticket.
     */
    function mint() external returns (uint256 tokenId) {
        // msg.sender is the address that approved this transaction in MetaMask.
        require(!hasMinted[msg.sender], "One ticket per wallet");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        // Record the claim before _safeMint makes a possible external callback.
        // If minting fails, Ethereum reverts this entire state change atomically.
        hasMinted[msg.sender] = true;

        // _safeMint creates the NFT and verifies that contract recipients can
        // receive ERC-721 tokens. Externally owned wallets are accepted directly.
        _safeMint(msg.sender, tokenId);

        emit Mint(msg.sender, tokenId);
    }
}
