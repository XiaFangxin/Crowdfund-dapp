const labels={signature:"Waiting for signature",submitted:"Transaction submitted",confirming:"Waiting for confirmation",success:"Transaction confirmed",failed:"Transaction failed",unknown:"Transaction confirmation unavailable"};
export default function TransactionStatus({transaction}) {
  if(transaction.status==="idle")return null;
  return <div className="transaction-status" role={transaction.status==="failed"?"alert":"status"} aria-live="polite"><strong>{labels[transaction.status]}</strong>{transaction.hash && <p><a href={`https://sepolia.etherscan.io/tx/${transaction.hash}`} target="_blank" rel="noopener noreferrer">{transaction.hash}</a></p>}{transaction.error && <p>{transaction.error}</p>}</div>;
}
