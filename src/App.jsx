import { useEffect, useState } from "react";
import { BrowserProvider, Contract, isAddress } from "ethers";
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID, TICKET_ABI } from "./contract.js";

const shortAddress = (address) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

function readableError(error) {
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

  const contractConfigured = isAddress(CONTRACT_ADDRESS || "");

  async function getProvider() {
    if (!window.ethereum) throw new Error("Install MetaMask to continue");
    return new BrowserProvider(window.ethereum);
  }

  async function ensureSepolia() {
    if (window.ethereum.chainId === SEPOLIA_CHAIN_ID) return;

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  }

  async function refreshMintStatus(address) {
    if (!address || !contractConfigured) return;
    try {
      const provider = await getProvider();
      const contract = new Contract(CONTRACT_ADDRESS, TICKET_ABI, provider);
      setHasMinted(await contract.hasMinted(address));
    } catch {
      setHasMinted(false);
    }
  }

  async function connectWallet() {
    setStatus("");
    try {
      const provider = await getProvider();
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
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, TICKET_ABI, signer);
      const transaction = await contract.mint();

      setTxHash(transaction.hash);
      setStatus("Transaction submitted. Waiting for confirmation...");
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

        {!account ? (
          <button onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <>
            <div className="wallet">
              <span>Connected wallet</span>
              <strong title={account}>{shortAddress(account)}</strong>
            </div>
            <button onClick={mintTicket} disabled={busy || hasMinted}>
              {busy ? "Minting..." : hasMinted ? "Ticket already minted" : "Mint Ticket"}
            </button>
          </>
        )}

        {status && <p className="status" role="status">{status}</p>}
        {txHash && (
          <a
            className="tx-link"
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction: {shortAddress(txHash)} ↗
          </a>
        )}
      </section>
    </main>
  );
}
