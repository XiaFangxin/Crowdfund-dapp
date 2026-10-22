import { useWalletSession } from "../../hooks/useWalletSession.jsx";
import useInteractionQuery from "../../hooks/useInteractionQuery.js";
import useOffchainAction from "../../hooks/useOffchainAction.js";
import { keyString } from "../../utils/interactionKey.js";
import { offchainConfigured } from "../../services/supabase.js";
export default function FavoriteButton({campaignKey}){
  const auth=useWalletSession(),action=useOffchainAction();
  const state=useInteractionQuery(signal=>auth.request("favorite.state",campaignKey,{signal}),[keyString(campaignKey),auth.wallet,auth.sessionKey],Boolean(campaignKey && auth.signedIn));
  if(!offchainConfigured)return null;
  async function toggle(){const result=await action.run(()=>auth.request("favorite.set",{...campaignKey,saved:!state.data.saved}));if(result)state.reload();}
  return <div><button disabled={!auth.signedIn || !state.data || action.busy || state.loading} onClick={toggle}>{state.data?.saved?"Unsave campaign":"Save campaign"} (no gas)</button>{!auth.signedIn && <p>Sign in to save campaigns across devices.</p>}{state.error && <p role="alert">{state.error}</p>}{action.error && <p role="alert">{action.error}</p>}{action.message && <p role="status">{action.message}</p>}</div>;
}
