import { useEffect, useRef, useState } from "react";
import useCategories from "../hooks/useCategories.js";
import useTransaction from "../hooks/useTransaction.js";
import TransactionStatus from "../components/TransactionStatus.jsx";
import CampaignMetadata from "../components/CampaignMetadata.jsx";
import { contentURL, fetchDocument } from "../services/metadata.js";
import { createCampaign, errorMessage, setCampaignMetadataURI } from "../services/crowdfunding.js";
import { contractConfigured, isV2 } from "../config/contracts.js";
import ContractStatus from "../components/ContractStatus.jsx";
import { validateCampaignForm } from "../utils/campaignForm.js";

const initialFields = { title: "", description: "", goal: "", deadline: "", categoryId: "" };
const fieldId = name => `campaign-${name}`;
const describedBy = (name, error) => `${fieldId(name)}-help${error ? ` ${fieldId(name)}-error` : ""}`;

function Field({ name, label, help, error, counter, children }) {
  return <div className="create-field">
    <label htmlFor={fieldId(name)}>{label}</label>
    {children}
    <div className="create-field-meta">
      <span className="create-help" id={`${fieldId(name)}-help`}>{help}</span>
      {counter && <span className="create-counter">{counter}</span>}
    </div>
    {error && <p className="create-error" id={`${fieldId(name)}-error`}>{error}</p>}
  </div>;
}

export default function CreateCampaign({ wallet }) {
  const categories = useCategories(wallet);
  const transaction = useTransaction();
  const [fields, setFields] = useState(initialFields);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [uri, setURI] = useState("");
  const [preview, setPreview] = useState("");
  const [metadataError, setMetadataError] = useState("");
  const [created, setCreated] = useState(null);
  const [attached, setAttached] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [operation, setOperation] = useState("create");
  const active = useRef(true);
  const lock = useRef(false);
  const validationRequest = useRef(null);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; validationRequest.current?.abort(); };
  }, []);

  const unknown = transaction.status === "unknown";
  const busy = preparing || transaction.busy;
  const walletReady = Boolean(contractConfigured && wallet.ethereum && wallet.account && wallet.isSepolia);
  const ready = walletReady && !busy && !unknown;
  const enabledCategories = categories.categories.filter(category => category.active);
  const categoryUnavailable = isV2 && (categories.loading || Boolean(categories.error) || !enabledCategories.length);
  const validationOptions = { isV2, categories: categories.categories };
  const validation = validateCampaignForm(fields, validationOptions);
  const visibleError = name => touched[name] || attempted ? validation.errors[name] : "";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "your browser's time zone";

  function changeField(event) {
    const { name, value } = event.target;
    setFields(previous => ({ ...previous, [name]: value }));
  }
  function blurField(event) {
    setTouched(previous => ({ ...previous, [event.target.name]: true }));
  }
  function editURI(event) {
    setURI(event.target.value);
    setPreview("");
    setMetadataError("");
  }
  function checkURI(value) {
    if (!value) return "";
    try { contentURL(value); return ""; }
    catch (error) { return errorMessage(error); }
  }
  function previewMetadata() {
    const value = uri.trim();
    const error = checkURI(value);
    setMetadataError(error);
    setPreview(error ? "" : value);
  }
  async function validateMetadata(value) {
    const controller = new AbortController();
    validationRequest.current = controller;
    await fetchDocument(value, "metadata", controller.signal);
  }
  async function submit(event) {
    event.preventDefault();
    if (!ready || lock.current || categoryUnavailable) return;
    const form = event.currentTarget;
    // Capture the same normalized values validation checks before any await.
    const checked = validateCampaignForm(fields, validationOptions);
    const submittedURI = isV2 ? uri.trim() : "";
    const uriError = checkURI(submittedURI);
    setAttempted(true);
    setMetadataError(uriError);
    const firstError = Object.keys(checked.errors)[0];
    if (firstError || uriError) {
      form.elements.namedItem(firstError || "metadataURI")?.focus();
      return;
    }
    lock.current = true;
    setOperation("create");
    setPreparing(true);
    try {
      if (submittedURI) await validateMetadata(submittedURI);
      if (!active.current) return;
      setPreparing(false);
      const result = await transaction.run(emit => createCampaign(wallet.ethereum, wallet.account, checked.values, emit));
      if (result && active.current) setCreated(result);
    } catch (error) {
      if (active.current) setMetadataError(errorMessage(error));
    } finally {
      lock.current = false;
      if (active.current) setPreparing(false);
    }
  }
  async function attach() {
    if (!ready || lock.current || created?.campaignId == null || attached) return;
    const submittedURI = uri.trim();
    const uriError = submittedURI ? checkURI(submittedURI) : "Enter a public metadata URI.";
    setMetadataError(uriError);
    if (uriError) return;
    lock.current = true;
    setOperation("attach");
    setPreparing(true);
    try {
      await validateMetadata(submittedURI);
      if (!active.current) return;
      setPreparing(false);
      const receipt = await transaction.run(emit => setCampaignMetadataURI(wallet.ethereum, wallet.account, created.campaignId, submittedURI, emit));
      if (receipt && active.current) setAttached(true);
    } catch (error) {
      if (active.current) setMetadataError(errorMessage(error));
    } finally {
      lock.current = false;
      if (active.current) setPreparing(false);
    }
  }

  const progressLabel = preparing ? "Validating metadata…"
    : transaction.status === "signature" ? "Confirm in MetaMask…"
    : transaction.busy ? "Waiting for confirmation…" : "";
  const walletMessage = !contractConfigured ? "Configure the deployed contract to create a campaign."
    : !wallet.ethereum ? "Install or enable MetaMask, then refresh this page."
    : !wallet.account ? "Connect your wallet to create a campaign."
    : !wallet.isSepolia ? "Switch your wallet to Sepolia to continue." : "";
  const knownId = created?.campaignId != null;
  const creationHash = created?.receipt?.hash;

  return <section className="create-campaign-page">
    <header className="create-page-heading">
      <p className="eyebrow">COMMUNITY FUNDING</p>
      <h1>Create Campaign</h1>
      <p className="page-subtitle">Share your idea, set a funding goal, and invite your community to contribute.</p>
    </header>
    <ContractStatus wallet={wallet} />
    {walletMessage && <div className="create-wallet-note" role="status">
      <p>{walletMessage}</p>
      {contractConfigured && wallet.ethereum && !wallet.account && <button type="button" onClick={wallet.connect} disabled={wallet.busy}>Connect Wallet</button>}
      {contractConfigured && wallet.ethereum && !wallet.isSepolia && <button type="button" onClick={wallet.switchToSepolia} disabled={wallet.busy}>Switch to Sepolia</button>}
    </div>}
    <div className="create-layout">
      <div className="create-main">
        {created ? <div className="create-success">
          <h2>{knownId ? `Campaign #${created.campaignId} created` : "Campaign created"}</h2>
          <p role="status">{knownId ? "Your campaign is open for contributions. Share its page with your community."
            : "The transaction is confirmed, but its campaign ID could not be read. Check My Campaigns or the transaction before creating another campaign."}</p>
          <div className="create-success-actions">
            {knownId && <a className="button" href={`#/campaign/${created.campaignId}`}>View campaign →</a>}
            <a href="#/my-campaigns">My Campaigns</a>
            {creationHash && <a href={`https://sepolia.etherscan.io/tx/${creationHash}`} target="_blank" rel="noopener noreferrer">View creation transaction ↗</a>}
          </div>
          {isV2 && knownId && !attached && <div className="create-metadata">
            <h3>Add project images and details</h3>
            <p>Your campaign is already created. Attaching metadata is a second transaction; if it fails, retry this step only.</p>
            <Field name="metadataURI" label="Metadata URI (optional)" help="Use a publicly hosted IPFS or HTTPS JSON document." error={metadataError}>
              <input id={fieldId("metadataURI")} name="metadataURI" value={uri} onChange={editURI} onBlur={() => setMetadataError(checkURI(uri.trim()))} maxLength={2048} disabled={!ready}
                aria-invalid={Boolean(metadataError)} aria-describedby={describedBy("metadataURI", metadataError)} placeholder="ipfs://… or https://…" />
            </Field>
            <button type="button" disabled={!ready || !uri.trim()} onClick={attach}>{busy && operation === "attach" ? progressLabel : "Attach metadata (second transaction)"}</button>
            <button className="button-secondary" type="button" disabled={!ready || !uri.trim()} onClick={previewMetadata}>Preview metadata</button>
          </div>}
          {attached && <p>Metadata attached. Your project details are ready to view.</p>}
        </div> : <form className="create-form" onSubmit={submit} noValidate>
          <fieldset className="create-fields" disabled={!ready}>
            <legend className="sr-only">Campaign details</legend>
            {attempted && (Object.keys(validation.errors).length > 0 || metadataError) && <div className="create-error-summary" role="alert">Please review the highlighted fields before continuing.</div>}
            <Field name="title" label="Campaign title *" help="Give your project a clear, memorable name." error={visibleError("title")} counter={`${fields.title.length} / 120`}>
              <input id={fieldId("title")} name="title" value={fields.title} onChange={changeField} onBlur={blurField} required maxLength={120} placeholder="e.g. A community garden for our campus"
                aria-invalid={Boolean(visibleError("title"))} aria-describedby={describedBy("title", visibleError("title"))} />
            </Field>
            <Field name="description" label="Description (optional)" help="Explain your idea, who it helps, and how the funds will be used." error={visibleError("description")} counter={`${fields.description.length} / 2,000`}>
              <textarea id={fieldId("description")} name="description" value={fields.description} onChange={changeField} onBlur={blurField} maxLength={2000} rows={6} placeholder="Tell your community about your project…"
                aria-invalid={Boolean(visibleError("description"))} aria-describedby={describedBy("description", visibleError("description"))} />
            </Field>
            <div className="create-field-row">
              <Field name="goal" label="Funding goal (ETH) *" help="Enter a positive decimal amount, such as 0.01. Up to 18 decimal places." error={visibleError("goal")}>
                <input id={fieldId("goal")} name="goal" value={fields.goal} onChange={changeField} onBlur={blurField} required inputMode="decimal" placeholder="0.01"
                  aria-invalid={Boolean(visibleError("goal"))} aria-describedby={describedBy("goal", visibleError("goal"))} />
              </Field>
              <Field name="deadline" label="Deadline (local time) *" help={`Choose a future date and time. Time zone: ${timeZone}.`} error={visibleError("deadline")}>
                <input id={fieldId("deadline")} name="deadline" value={fields.deadline} onChange={changeField} onBlur={blurField} required type="datetime-local"
                  aria-invalid={Boolean(visibleError("deadline"))} aria-describedby={describedBy("deadline", visibleError("deadline"))} />
              </Field>
            </div>
            {isV2 && <>
              <Field name="categoryId" label="Category *" help="Select an enabled category for your project." error={visibleError("categoryId")}>
                <select id={fieldId("categoryId")} name="categoryId" value={fields.categoryId} onChange={changeField} onBlur={blurField} required disabled={categories.loading || Boolean(categories.error) || !enabledCategories.length}
                  aria-invalid={Boolean(visibleError("categoryId"))} aria-describedby={describedBy("categoryId", visibleError("categoryId"))}>
                  <option value="">Select an enabled category</option>
                  {enabledCategories.map(category => <option key={category.id} value={category.id}>{category.name} #{category.id}</option>)}
                </select>
              </Field>
              {categories.loading && <p role="status">Loading categories…</p>}
              {categories.error && <p className="create-error" role="alert">{categories.error}</p>}
              {walletReady && !categories.loading && !categories.error && !enabledCategories.length && <p role="status">No enabled categories are available. Campaign creation will be available when a category is enabled.</p>}
              <button type="button" className="button-secondary" disabled={categories.loading || busy} onClick={categories.reload}>Refresh categories</button>
              <div className="create-metadata">
                <h2>Project images and details</h2>
                <p>Optional: add a public metadata document. It can be attached after the campaign is created.</p>
                <Field name="metadataURI" label="Metadata URI (optional)" help="Host and pin your image and JSON first. Image upload is not available here." error={metadataError}>
                  <input id={fieldId("metadataURI")} name="metadataURI" value={uri} onChange={editURI} onBlur={() => setMetadataError(checkURI(uri.trim()))} maxLength={2048} placeholder="ipfs://… or https://…"
                    aria-invalid={Boolean(metadataError)} aria-describedby={describedBy("metadataURI", metadataError)} />
                </Field>
                <button type="button" className="button-secondary" disabled={!uri.trim() || busy} onClick={previewMetadata}>Validate and preview JSON</button>
              </div>
            </>}
            <div className="create-submit-row">
              <button className="create-submit" type="submit" disabled={!ready || categoryUnavailable}>{busy ? progressLabel : `Create campaign${isV2 && uri.trim() ? " (step 1 of 2)" : ""}`}</button>
              <p>Confirm in MetaMask. Creating a campaign uses Sepolia test ETH for gas.</p>
            </div>
          </fieldset>
        </form>}
        {unknown && <div className="create-error-summary" role="alert">
          {operation === "attach" ? "Metadata confirmation is unavailable. Your campaign remains created." : "Creation confirmation is unavailable. The campaign may already exist."} Check the transaction in MetaMask or Etherscan before submitting again.
        </div>}
        <TransactionStatus transaction={transaction} />
        {isV2 && <details className="create-metadata-code"><summary>Metadata format and hosting requirements</summary>
          <p>Use public IPFS or HTTPS JSON that allows browser CORS access. The category is selected on chain. Metadata is checked again before submission.</p>
          <pre>{JSON.stringify({ schemaVersion: "1.0", image: "ipfs://YOUR_IMAGE_CID/cover.png", summary: "Short summary", additionalDescription: "Detailed project description" }, null, 2)}</pre>
        </details>}
        {preview && <div className="create-preview"><h2>Metadata preview</h2><CampaignMetadata uri={preview} /></div>}
      </div>
      <aside className="create-guide" aria-labelledby="create-guide-heading">
        <h2 id="create-guide-heading">Before you create</h2>
        <ol className="create-steps">
          <li><strong>Tell your story</strong><p>Describe the project and how your community will benefit.</p></li>
          <li><strong>Set a clear goal</strong><p>Choose an ETH target and deadline carefully. These funding terms cannot be changed later.</p></li>
          <li><strong>Review and confirm</strong><p>Check your details, confirm in MetaMask, and wait for the transaction receipt.</p></li>
        </ol>
        <div className="create-guide-note"><p>After the deadline, the creator can withdraw if the goal is reached. Otherwise, contributors can claim their refunds.</p></div>
      </aside>
    </div>
  </section>;
}
