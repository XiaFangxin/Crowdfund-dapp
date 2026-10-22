import { offchainConfigured } from "../../services/supabase.js";
import { recordView } from "../../services/interactions.js";
import { keyString } from "../../utils/interactionKey.js";
import useInteractionQuery from "../../hooks/useInteractionQuery.js";
export default function Views({campaignKey}){
  const state=useInteractionQuery(signal=>recordView(campaignKey,signal),[keyString(campaignKey)],Boolean(campaignKey));
  if(!offchainConfigured)return <p>Views unavailable: off-chain service not configured.</p>;
  return <p role="status">{state.data?`${state.data.views} approximate views (deduplicated; not on-chain data)` : state.error?`Views unavailable: ${state.error}`:"Recording approximate view..."}</p>;
}
