import { useEffect, useState } from "react";
import useWallet from "./hooks/useWallet.js";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import CreateCampaign from "./pages/CreateCampaign.jsx";
import CampaignDetail from "./pages/CampaignDetail.jsx";
import MyCampaigns from "./pages/MyCampaigns.jsx";
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
  else if (route === "/create") page = <CreateCampaign wallet={wallet} />;
  else if (route === "/my-campaigns") page = <MyCampaigns wallet={wallet} />;
  else if (detail) page = <CampaignDetail key={detail[1]} wallet={wallet} id={detail[1]} />;
  else page = <section><h2>Page not found</h2><a href="#/">Back to Home</a></section>;
  return <><Navbar wallet={wallet} /><main>{page}</main></>;
}

export default App;
