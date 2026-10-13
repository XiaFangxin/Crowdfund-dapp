import { useCallback, useEffect, useState } from "react";
import { contractConfigured } from "../config/contracts.js";
import { errorMessage, listCampaigns } from "../services/crowdfunding.js";

export default function useCampaigns(wallet) {
  const [retry, setRetry] = useState(0);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  const [state, setState] = useState({ campaigns: [], loading: false, loaded: false, error: "" });
  useEffect(() => {
    let active = true;
    if (!contractConfigured || !wallet.ethereum || !wallet.isSepolia) {
      setState({ campaigns: [], loading: false, loaded: false, error: "" });
      return;
    }
    setState({ campaigns: [], loading: true, loaded: false, error: "" });
    listCampaigns(wallet.ethereum).then(
      (campaigns) => { if (active) setState({ campaigns, loading: false, loaded: true, error: "" }); },
      (error) => { if (active) setState({ campaigns: [], loading: false, loaded: false, error: errorMessage(error) }); },
    );
    return () => { active = false; };
  }, [wallet.ethereum, wallet.isSepolia, wallet.revision, retry]);
  return { ...state, reload };
}
