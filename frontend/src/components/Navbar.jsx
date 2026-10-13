import ConnectWallet from "./ConnectWallet.jsx";

export default function Navbar({ wallet, route }) {
  return <header className="site-header">
    <div className="navbar-inner">
      <a href="#/" className="brand" aria-label="Crowdfund home"><span aria-hidden="true">◈</span> Crowdfund</a>
      <nav aria-label="Main navigation">
        <a href="#/" aria-current={route === "/" ? "page" : undefined}>Explore</a>
        <a href="#/create" aria-current={route === "/create" ? "page" : undefined}>Create Campaign</a>
        <a href="#/my-campaigns" aria-current={route === "/my-campaigns" ? "page" : undefined}>My Campaigns</a>
        <a href="#/my-contributions" aria-current={route === "/my-contributions" ? "page" : undefined}>My Contributions</a>
      </nav>
      <ConnectWallet wallet={wallet} />
    </div>
    {wallet.error && <p className="wallet-error" role="alert">{wallet.error}</p>}
  </header>;
}
