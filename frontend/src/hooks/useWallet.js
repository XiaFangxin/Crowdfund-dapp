import { useCallback, useEffect, useRef, useState } from "react";
import { SEPOLIA_CHAIN_HEX, SEPOLIA_CHAIN_ID } from "../config/network.js";

function findMetaMask() {
  const injected = window.ethereum;
  return injected?.providers?.find((provider) => provider.isMetaMask)
    ?? (injected?.isMetaMask ? injected : null);
}

export default function useWallet() {
  const [ethereum, setEthereum] = useState(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);

  const refresh = useCallback(async (provider, requestAccess = false) => {
    const current = ++generation.current;
    try {
      const accounts = await provider.request({ method: requestAccess ? "eth_requestAccounts" : "eth_accounts" });
      const chain = await provider.request({ method: "eth_chainId" });
      if (current !== generation.current) return;
      setAccount(accounts[0] ?? "");
      setChainId(Number(chain));
      setError("");
      setRevision((value) => value + 1);
    } catch (err) {
      if (current !== generation.current) return;
      setAccount("");
      setChainId(null);
      setError(err.code === 4001 ? "Wallet request rejected." : err.message ?? "Wallet unavailable.");
    }
  }, []);

  useEffect(() => {
    let provider;
    const changed = () => { void refresh(provider); };
    const disconnected = () => {
      ++generation.current;
      setAccount("");
      setChainId(null);
      setRevision((value) => value + 1);
    };
    const detect = () => {
      const detected = findMetaMask();
      if (!detected || provider) return;
      provider = detected;
      setEthereum(provider);
      provider.on?.("accountsChanged", changed);
      provider.on?.("chainChanged", changed);
      provider.on?.("disconnect", disconnected);
      void refresh(provider);
    };
    detect();
    window.addEventListener("ethereum#initialized", detect);
    return () => {
      ++generation.current;
      window.removeEventListener("ethereum#initialized", detect);
      provider?.removeListener?.("accountsChanged", changed);
      provider?.removeListener?.("chainChanged", changed);
      provider?.removeListener?.("disconnect", disconnected);
    };
  }, [refresh]);

  async function connect() {
    if (!ethereum) return;
    setBusy(true);
    try { await refresh(ethereum, true); } finally { setBusy(false); }
  }

  async function switchToSepolia() {
    if (!ethereum) return;
    setBusy(true);
    try {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_HEX }] });
      await refresh(ethereum);
    } catch (err) {
      setError(err.code === 4902 ? "Enable Sepolia in MetaMask's test networks, then try again." : err.message ?? "Network switch failed.");
    } finally { setBusy(false); }
  }

  return { ethereum, account, chainId, isSepolia: chainId === SEPOLIA_CHAIN_ID, error, busy, revision, connect, switchToSepolia };
}
