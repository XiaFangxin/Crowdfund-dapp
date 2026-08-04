export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

export const TICKET_ABI = [
  "function mint() returns (uint256 tokenId)",
  "function hasMinted(address account) view returns (bool)",
  "event Mint(address indexed minter, uint256 indexed tokenId)",
];

export const SEPOLIA_CHAIN_ID = "0xaa36a7";
