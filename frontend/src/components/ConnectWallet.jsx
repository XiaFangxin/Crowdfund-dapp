export default function ConnectWallet({ wallet }) {
  return <div>
    {!wallet.ethereum ? <p>MetaMask not detected. Install or enable the extension, then refresh.</p>
      : <>
        {wallet.account ? <p>Wallet: <code>{wallet.account}</code></p>
          : <button disabled={wallet.busy} onClick={wallet.connect}>Connect Wallet</button>}
        <p>Network: {wallet.chainId === null ? "Unknown" : wallet.isSepolia ? "Sepolia" : `Chain ${wallet.chainId} — Sepolia required`}</p>
        {!wallet.isSepolia && <button disabled={wallet.busy} onClick={wallet.switchToSepolia}>Switch to Sepolia</button>}
      </>}
    {wallet.error && <p role="alert">{wallet.error}</p>}
  </div>;
}
