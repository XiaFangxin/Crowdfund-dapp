import { useEffect, useState } from "react";
import { BrowserProvider, Contract, isAddress } from "ethers";
import {
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER_URL,
  TICKET_ABI,
} from "./contract.js";

const shortAddress = (address) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

function readableError(error) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") {
    return "The MetaMask request was rejected. You can try again when ready.";
  }

  return (
    error?.revert?.args?.[0] ||
    error?.info?.error?.message ||
    error?.shortMessage ||
    error?.message ||
    "Something went wrong"
  );
}

export default function App() {
  const [account, setAccount] = useState("");
  const [hasMinted, setHasMinted] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // A deployed contract address is always a 20-byte Ethereum address.
  const contractConfigured = isAddress(CONTRACT_ADDRESS);

  let mintButtonLabel = "Mint Ticket";
  if (!contractConfigured) mintButtonLabel = "Configure contract first";
  if (hasMinted) mintButtonLabel = "Ticket already minted";
  if (busy) mintButtonLabel = "Minting...";

  function getProvider() {
    // MetaMask injects window.ethereum, an EIP-1193 provider, into the page.
    if (!window.ethereum) throw new Error("Install MetaMask to continue");
    return new BrowserProvider(window.ethereum);
  }

  async function ensureSepolia() {
    const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
    if (currentChainId === SEPOLIA_CHAIN_ID) return;

    // Ask MetaMask to move away from Mainnet or another network before minting.
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  }

  async function refreshMintStatus(address) {
    if (!address || !contractConfigured) {
      setHasMinted(false);
      return;
    }

    try {
      // A provider is enough for free, read-only calls; MetaMask does not prompt.
      const provider = getProvider();
      const contract = new Contract(CONTRACT_ADDRESS, TICKET_ABI, provider);
      setHasMinted(await contract.hasMinted(address));
    } catch {
      setHasMinted(false);
    }
  }

  async function connectWallet() {
    setStatus("");
    try {
      const provider = getProvider();

      // eth_requestAccounts opens MetaMask's account permission prompt.
      const accounts = await provider.send("eth_requestAccounts", []);
      await ensureSepolia();
      setAccount(accounts[0]);
      await refreshMintStatus(accounts[0]);
    } catch (error) {
      setStatus(readableError(error));
    }
  }

  async function mintTicket() {
    if (!contractConfigured) {
      setStatus("Add the deployed contract address to your .env file first.");
      return;
    }

    setBusy(true);
    setStatus("Confirm the transaction in MetaMask...");
    setTxHash("");

    try {
      await ensureSepolia();

      const provider = getProvider();
      // A signer represents the connected account and can approve state-changing calls.
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, TICKET_ABI, signer);

      // This sends a transaction. The Solidity mint() function runs only after
      // the user confirms in MetaMask and Sepolia includes it in a block.
      const transaction = await contract.mint();

      setTxHash(transaction.hash);
      setStatus("Transaction submitted. Waiting for confirmation...");

      // wait() resolves after the transaction is mined, not merely submitted.
      await transaction.wait();

      setHasMinted(true);
      setStatus("Ticket minted successfully!");
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!window.ethereum) return undefined;

    // Keep the interface accurate when the user changes account or network in MetaMask.
    const onAccountsChanged = (accounts) => {
      const nextAccount = accounts[0] || "";
      setAccount(nextAccount);
      setTxHash("");
      setStatus("");
      refreshMintStatus(nextAccount);
    };
    const onChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    // Removing listeners prevents duplicate handlers after React remounts the component.
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, [contractConfigured]);

  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">ETHEREUM SEPOLIA</span>
        <div className="ticket-icon" aria-hidden="true">🎟️</div>
        <h1>NFT Event Ticket</h1>
        <p className="subtitle">Connect your wallet and mint one free ticket.</p>

        {!contractConfigured && (
          <p className="config-notice" role="status">
            Setup needed: add your deployed Sepolia contract address to <code>.env</code>.
          </p>
        )}

        {!account ? (
          <button onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <>
            <div className="wallet">
              <span>Connected wallet</span>
              <strong title={account}>{shortAddress(account)}</strong>
            </div>
            <button onClick={mintTicket} disabled={busy || hasMinted || !contractConfigured}>
              {mintButtonLabel}
            </button>
          </>
        )}

        {status && <p className="status" role="status">{status}</p>}
        {txHash && (
          <a
            className="tx-link"
            href={`${SEPOLIA_EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction: {shortAddress(txHash)} ↗
          </a>
        )}

        <div className="mint-flow">
          <strong>What happens when you mint?</strong>
          <ol>
            <li>MetaMask connects your public wallet address.</li>
            <li>You approve a Sepolia transaction and its testnet gas fee.</li>
            <li>The contract creates the NFT and records your wallet as its owner.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
