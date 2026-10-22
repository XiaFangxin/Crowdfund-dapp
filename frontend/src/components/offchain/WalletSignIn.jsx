import { useWalletSession } from "../../hooks/useWalletSession.jsx";
import { offchainConfigured,offchainMessage } from "../../services/supabase.js";
export default function WalletSignIn({wallet}){
  const auth=useWalletSession();
  if(!offchainConfigured)return <p role="status">{offchainMessage}</p>;
  return <div className="offchain-login"><p>Comments, saves and reports are off chain and cost no gas. Wallet login uses a domain-bound message signature, not a transaction.</p>
    {auth.signedIn?<><span>Verified wallet: {auth.wallet.slice(0,6)}...{auth.wallet.slice(-4)}</span><button disabled={auth.busy} onClick={auth.logout}>Sign out of interactions</button></>:<button disabled={!wallet.account || !wallet.isSepolia || auth.busy} onClick={auth.login}>{auth.busy?"Verify in MetaMask...":"Sign in with wallet (no gas)"}</button>}
    {auth.error && <p role="alert">{auth.error}</p>}{auth.pendingSignouts>0 && <button onClick={auth.retrySignouts}>Retry pending server sign-outs</button>}
  </div>;
}
