export async function waitForTransaction(send, emit = () => {}) {
  emit({ status: "signature", hash: "", error: "" });
  const tx = await send();
  emit({ status: "submitted", hash: tx.hash, error: "" });
  // Let the submitted phase render before entering confirmation.
  await new Promise(resolve => setTimeout(resolve, 0));
  emit({ status: "confirming", hash: tx.hash, error: "" });
  let receipt;
  try { receipt = await tx.wait(); }
  catch (error) {
    if (error.code !== "TRANSACTION_REPLACED") {
      if(error.receipt && Number(error.receipt.status)===0)throw error;
      throw confirmationUnknown(error);
    }
    if (error.replacement?.hash) emit({ status: "confirming", hash: error.replacement.hash, error: "" });
    if (error.cancelled) throw new Error("Transaction was cancelled or replaced with a different action. Check your wallet activity.");
    receipt = error.receipt;
  }
  if (!receipt)throw confirmationUnknown();
  if (Number(receipt.status) !== 1) throw new Error("Transaction reverted on chain.");
  emit({ status: "success", hash: receipt.hash ?? tx.hash, error: "" });
  return receipt;
}
function confirmationUnknown(cause) {
  const error=new Error("Confirmation is unavailable. This transaction may still be pending or confirmed. Check its hash in MetaMask or Etherscan before submitting again.",{cause});
  error.code="CONFIRMATION_UNKNOWN";
  return error;
}
