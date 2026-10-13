export default function ConnectWallet({ wallet }) {
  const network = !wallet.ethereum ? "Sepolia required" : wallet.isSepolia ? "Sepolia" : wallet.chainId === null ? "Network unknown" : `Chain ${wallet.chainId}`;
  return <div className="wallet-controls">
    <span className={`network-chip${wallet.isSepolia ? " network-connected" : ""}`}>{network}</span>
    {wallet.account ? <span className="wallet-account" title={wallet.account} aria-label={`Connected wallet ${wallet.account}`}>
      {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
    </span> : <button disabled={wallet.busy || !wallet.ethereum} onClick={wallet.connect}
      title={!wallet.ethereum ? "Install or enable MetaMask, then refresh." : undefined}>{wallet.busy ? "Connecting…" : "Connect Wallet"}</button>}
    {wallet.ethereum && !wallet.isSepolia && <button className="button-secondary" disabled={wallet.busy} onClick={wallet.switchToSepolia}>Switch to Sepolia</button>}
  </div>;
}
