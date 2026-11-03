import { useState } from "react";
import { ownershipTarget, transferOwnership, acceptOwnership } from "../services/crowdfunding.js";
export default function OwnershipControls({wallet, ownership, transaction, onAction}) {
  const [target,setTarget] = useState("");
  const [confirmed,setConfirmed] = useState(false);
  let validation = "";
  if (target) { try { if (ownershipTarget(target).toLowerCase() === ownership.data?.owner.toLowerCase()) validation = "Choose a different administrator."; } catch (error) { validation = error.message; } }
  const candidate = Boolean(wallet.account && ownership.data?.pendingOwner?.toLowerCase() === wallet.account.toLowerCase());
  const locked = transaction.busy || transaction.status === "unknown" || ownership.loading || Boolean(ownership.error) || !wallet.isSepolia;
  if (!ownership.isOwner && !candidate) return null;
  return <section aria-label="Administrator handover"><h2>Administrator handover</h2>
    <p>Two Sepolia transactions with gas: the current owner nominates an address, then that wallet accepts. Until acceptance the current owner keeps control. This does not transfer campaign funds.</p>
    {ownership.isOwner && <form onSubmit={event=>{event.preventDefault();if(!locked && target && !validation && confirmed)void onAction(emit=>transferOwnership(wallet.ethereum,wallet.account,target,emit));}}>
      <label>New administrator address<input value={target} onChange={event=>{setTarget(event.target.value);setConfirmed(false);}} required /></label>
      {validation && <p role="alert">{validation}</p>}
      <label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> I have verified this address and its wallet holder. This replaces any pending nomination.</label>
      <button disabled={locked || !target || Boolean(validation) || !confirmed}>Nominate administrator</button>
    </form>}
    {candidate && <button disabled={locked} onClick={()=>onAction(emit=>acceptOwnership(wallet.ethereum,wallet.account,emit))}>Accept administrator role</button>}
  </section>;
}
