import { useEffect, useState } from "react";
import { WalletSessionProvider } from "./hooks/useWalletSession.jsx";
import useWallet from "./hooks/useWallet.js";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import CreateCampaign from "./pages/CreateCampaign.jsx";
import CampaignDetail from "./pages/CampaignDetail.jsx";
import MyCampaigns from "./pages/MyCampaigns.jsx";
import Profile from "./pages/Profile.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import { contractKey } from "./config/contracts.js";
import MyContributions from "./pages/MyContributions.jsx";
import "./styles.css";

function App() {
  const wallet = useWallet();
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const changed = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const detail = route.match(/^\/campaign\/(\d+)$/);
  let page;
  if (route === "/") page = <Home wallet={wallet} />;
  else if (route === "/profile") page = <Profile wallet={wallet} />;
  else if (route === "/admin") page = <AdminDashboard wallet={wallet} />;
  else if (route === "/create") page = <CreateCampaign wallet={wallet} />;
  else if (route === "/my-campaigns") page = <MyCampaigns wallet={wallet} />;
  else if (route === "/my-contributions") page = <MyContributions wallet={wallet} />;
  else if (detail) page = <CampaignDetail key={detail[1]} wallet={wallet} id={detail[1]} />;
  else page = <section><h2>Page not found</h2><a href="#/">Back to Home</a></section>;
  return <WalletSessionProvider wallet={wallet}><Navbar wallet={wallet} route={route} /><main id="main-content"><div key={`${contractKey}:${wallet.account}:${wallet.chainId}:${wallet.revision}:${route}`}>{page}</div></main>
    <footer className="site-footer"><span>Crowdfund · A community crowdfunding demo</span><span>Test network · Sepolia</span></footer></WalletSessionProvider>;
}

export default App;
