import { useEffect, useState } from "react";
import { formatEther } from "ethers";
import { contribute, errorMessage, getCampaign, getContribution, refund, withdraw } from "../services/crowdfunding.js";
import { contractConfigured } from "../config/contracts.js";
import ContractStatus from "../components/ContractStatus.jsx";

export default function CampaignDetail({ wallet, id }) {
  const [campaign, setCampaign] = useState(null);
  const [contribution, setContribution] = useState(0n);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setCampaign(null);
    setContribution(0n);
    setError("");
    if (!contractConfigured || !wallet.ethereum || !wallet.isSepolia) return;
    Promise.all([getCampaign(wallet.ethereum, id), wallet.account ? getContribution(wallet.ethereum, id, wallet.account) : 0n])
      .then(([data, value]) => { if (active) { setCampaign(data); setContribution(value); } })
      .catch((err) => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, [id, wallet.ethereum, wallet.account, wallet.isSepolia, wallet.revision, reload]);

  async function transact(action) {
    setPending(true);
    setMessage("Confirm in MetaMask, then wait for the transaction receipt.");
    try {
      await action();
      setMessage("Transaction confirmed.");
      setReload((value) => value + 1);
    } catch (err) { setMessage(errorMessage(err)); }
    finally { setPending(false); }
  }
  const ready = !pending && wallet.account && wallet.isSepolia && contractConfigured;
  const ended = campaign && campaign.deadline <= Date.now() / 1000;
  const successful = campaign && campaign.amountRaised >= campaign.goal;
  const creator = campaign && campaign.creator.toLowerCase() === wallet.account.toLowerCase();
  return <section><h2>Campaign Detail #{id}</h2><ContractStatus wallet={wallet} />
    {error && <p role="alert">{error}</p>}
    {!campaign && !error && contractConfigured && wallet.isSepolia && <p>Loading campaign…</p>}
    {campaign && <>
      <h3>{campaign.title}</h3><p>{campaign.description}</p>
      <p>Creator: <code>{campaign.creator}</code></p>
      <p>Raised: {formatEther(campaign.amountRaised)} / {formatEther(campaign.goal)} ETH</p>
      <p>Deadline: {new Date(campaign.deadline * 1000).toLocaleString()}</p>
      <p>Status: {campaign.withdrawn ? "Withdrawn" : ended ? successful ? "Successful" : "Failed" : "Active"}</p>
      <p>Your refundable contribution on failure: {formatEther(contribution)} ETH</p>
      <form onSubmit={(event) => { event.preventDefault(); void transact(() => contribute(wallet.ethereum, wallet.account, id, amount)); }}>
        <label>Contribution (ETH)<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required /></label>
        <button disabled={!ready || ended}>Contribute</button>
      </form>
      <button disabled={!ready || !creator || !ended || !successful || campaign.withdrawn}
        onClick={() => transact(() => withdraw(wallet.ethereum, wallet.account, id))}>Withdraw</button>{" "}
      <button disabled={!ready || !ended || successful || contribution === 0n}
        onClick={() => transact(() => refund(wallet.ethereum, wallet.account, id))}>Refund</button>
      <p>Withdraw after the deadline if the goal was reached; otherwise contributors may refund. Reload the page after the deadline to refresh eligibility.</p>
    </>}
    <p role="status">{message}</p>
  </section>;
}
