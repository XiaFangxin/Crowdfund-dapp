/**
 * The contract address tells ethers where this particular TicketNFT contract
 * lives on Sepolia. It is public information, like a website's URL.
 *
 * Vite exposes variables prefixed with VITE_ to browser code at build time.
 */
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";

/**
 * An ABI (Application Binary Interface) describes how JavaScript can call a
 * smart contract. ethers supports this short "human-readable" ABI, so this app
 * only lists the contract functions and events it actually uses.
 */
export const TICKET_ABI = [
  "function mint() returns (uint256 tokenId)",
  "function hasMinted(address account) view returns (bool)",
  "event Mint(address indexed minter, uint256 indexed tokenId)",
];

// MetaMask uses hexadecimal chain IDs. 0xaa36a7 equals Sepolia's decimal ID 11155111.
export const SEPOLIA_CHAIN_ID = "0xaa36a7";

export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";
