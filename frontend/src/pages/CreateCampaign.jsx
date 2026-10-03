import { useState } from "react";
import { createCampaign, errorMessage } from "../services/crowdfunding.js";
import { contractConfigured } from "../config/contracts.js";
import ContractStatus from "../components/ContractStatus.jsx";

export default function CreateCampaign({ wallet }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setPending(true);
    setMessage("Confirm in MetaMask, then wait for the transaction receipt.");
    try {
      await createCampaign(wallet.ethereum, wallet.account, values);
      setMessage("Campaign created. Visit Home to see it.");
      form.reset();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setPending(false); }
  }
  return <section><h2>Create Campaign</h2><ContractStatus wallet={wallet} />
    <form onSubmit={submit}>
      <label>Title<input name="title" required maxLength={120} /></label>
      <label>Description<textarea name="description" maxLength={2000} /></label>
      <label>Goal (ETH)<input name="goal" type="text" inputMode="decimal" placeholder="0.1" required /></label>
      <label>Deadline (your local time)<input name="deadline" type="datetime-local" required /></label>
      <button disabled={pending || !contractConfigured || !wallet.account || !wallet.isSepolia}>
        {pending ? "Waiting for confirmation…" : "Create Campaign"}
      </button>
    </form><p role="status">{message}</p>
  </section>;
}
