import { useEffect, useState } from "react";
import { contractConfigured } from "../config/contracts.js";
import { errorMessage, listCampaigns } from "../services/crowdfunding.js";

export default function useCampaigns(wallet) {
  const [state, setState] = useState({ campaigns: [], loading: false, error: "" });
  useEffect(() => {
    let active = true;
    if (!contractConfigured || !wallet.ethereum || !wallet.isSepolia) {
      setState({ campaigns: [], loading: false, error: "" });
      return;
    }
    setState({ campaigns: [], loading: true, error: "" });
    listCampaigns(wallet.ethereum).then(
      (campaigns) => { if (active) setState({ campaigns, loading: false, error: "" }); },
      (error) => { if (active) setState({ campaigns: [], loading: false, error: errorMessage(error) }); },
    );
    return () => { active = false; };
  }, [wallet.ethereum, wallet.isSepolia, wallet.revision]);
  return state;
}
