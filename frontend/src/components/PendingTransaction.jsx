import { useEffect, useState } from "react";
import { pendingKey, readPending } from "../services/pendingTransactions.js";
import { recoverPendingTransaction, errorMessage } from "../services/crowdfunding.js";
import { crowdfundingAddress } from "../config/contracts.js";
import { SEPOLIA_CHAIN_ID } from "../config/network.js";

export default function PendingTransaction({wallet}) {
  const [record,setRecord] = useState(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [replacement,setReplacement] = useState("");
  useEffect(() => {
    const sync = () => { try { setRecord(readPending(pendingKey(SEPOLIA_CHAIN_ID,crowdfundingAddress,wallet.account))); setError(""); } catch (failure) { setError(errorMessage(failure)); } };
    sync(); window.addEventListener("storage",sync); window.addEventListener("crowdfund:pending",sync);
    return () => { window.removeEventListener("storage",sync); window.removeEventListener("crowdfund:pending",sync); };
  },[wallet.account]);
  async function check() {
    setBusy(true); setError("");
    try { setRecord(await recoverPendingTransaction(wallet.ethereum,wallet.account,replacement)); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  if (!record && !error) return null;
  return <aside className="transaction-status" aria-label="Saved transaction" aria-live="polite">
    {record && <><strong>{record.status === "success" ? "Saved transaction confirmed" : record.status === "failed" ? "Saved transaction reverted" : "Unresolved transaction — do not submit again"}</strong><p>{record.method}: <a href={`https://sepolia.etherscan.io/tx/${record.hash}`} target="_blank" rel="noopener noreferrer">{record.hash}</a></p>
      {record.volatile && <p role="alert">Could not persist this hash. Copy it now and check MetaMask before refreshing or sending another transaction.</p>}
      {record.campaignId != null && <a href={`#/campaign/${record.campaignId}`}>Open recovered campaign #{record.campaignId}</a>}
      {!["success","failed"].includes(record.status) && <><p>Check the receipt before making another transaction. A missing receipt may mean pending, dropped or replaced; inspect MetaMask activity. This app never resends automatically.</p><label>Replacement / cancellation hash (optional, same wallet and nonce)<input value={replacement} onChange={event=>setReplacement(event.target.value)} /></label><button disabled={busy || !wallet.isSepolia} onClick={check}>{busy ? "Checking receipt..." : "Check saved transaction"}</button></>}
      {["success","failed"].includes(record.status) && <p>Refresh this page to reload campaign and permission data.</p>}</>}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
