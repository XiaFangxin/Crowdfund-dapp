// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title TicketNFT
/// @notice A simple, free NFT ticket with a limit of one ticket per wallet.
contract TicketNFT is ERC721 {
    uint256 private _nextTokenId = 1;

    mapping(address => bool) public hasMinted;

    event Mint(address indexed minter, uint256 indexed tokenId);

    constructor() ERC721("Ticket NFT", "TICKET") {}

    function mint() external returns (uint256 tokenId) {
        require(!hasMinted[msg.sender], "One ticket per wallet");

        tokenId = _nextTokenId;
        unchecked {
            _nextTokenId = tokenId + 1;
        }

        // Update state before _safeMint, which may call the receiver contract.
        hasMinted[msg.sender] = true;
        _safeMint(msg.sender, tokenId);

        emit Mint(msg.sender, tokenId);
    }
}
