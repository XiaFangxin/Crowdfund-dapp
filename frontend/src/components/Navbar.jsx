import ConnectWallet from "./ConnectWallet.jsx";

export default function Navbar({ wallet }) {
  return <header>
    <h1>Crowdfund DApp</h1>
    <p>Decentralized crowdfunding on Ethereum Sepolia</p>
    <nav aria-label="Main navigation">
      <a href="#/">Home</a>{" | "}<a href="#/create">Create Campaign</a>{" | "}<a href="#/my-campaigns">My Campaigns</a>
    </nav>
    <ConnectWallet wallet={wallet} />
  </header>;
}
