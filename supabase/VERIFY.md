# Supabase off-chain module verification

Run locally, without Supabase credentials or a chain connection:

```sh
npm --prefix supabase ci --ignore-scripts
npm --prefix supabase run check
npm --prefix supabase test
npm --prefix frontend test
npm --prefix frontend run build
```

The backend tests execute the real migration in PGlite (PostgreSQL WASM), with
`anon`, `authenticated` and a test service role, plus the actual Edge request
handler. Only the chain RPC is mocked. They do not deploy or connect to Supabase.
`tests/chain.test.js` tests the actual server chain authority using an ethers
read-only mock runner, including owner changes and RPC/network failures.

After manually deploying to a Supabase test project, repeat these browser checks:

1. Allowed origin: open Campaign Detail without signing in. Approximate views
   appear; refresh in the same 30-minute bucket must not increase the count.
   A visitor token is not a login session. No MetaMask signature prompt occurs.
2. Sign in as wallet A. Inspect SIWE domain, URI, chain, expiration and nonce.
   It is `personal_sign`, never `eth_sendTransaction`. Cancel once, then retry.
3. Post a comment and a one-level reply, load next/previous pages, hide A's
   comment. A hidden comment becomes a public tombstone; its replies remain.
4. In another browser/device, sign in as A and recover saved campaigns. Sign in
   as B: A's saves must not appear, and forged walletAddress fields must not let B
   hide A's comment. Direct Data API reads/writes with public keys must fail.
5. Replay an auth.verify request: reject it. Wait past challenge/session expiry:
   reject it. Log out and replay the old bearer: reject it. Switch wallet/chain:
   clear private UI immediately and revoke its server session. Offline sign-out
   must show pending revocation; retry when online.
6. Send a report twice as A: reject duplicate target reports even with different
   request IDs. A normal wallet cannot list reports or supply an isAdmin flag.
7. With a real V2 deployment manually configured in the server allowlist and
   MODERATION_CONTRACT_ADDRESS, sign in as the current owner. Mark reports in
   review/resolved/dismissed and optionally hide a reported comment. Confirm the
   audit row records the owner-check block and action. Transfer ownership using
   the existing contract workflow: the former owner must lose server access.
8. Resolving a campaign report alone must produce no chain transaction. Only a
   separate explicit "Pause new contributions (on-chain)" click, confirmation,
   and MetaMask signature on the matching current V2 deployment may submit one.
   Do not perform this live step without the team's explicit test authorization.
9. Disable the service or clear its public settings: chain funding screens stay
   usable, counters show unavailable, social writes/sign-in are unavailable, and
   no dummy comments, saves or statistics appear.

Run `tests/verify_permissions.sql` in the Supabase SQL editor to check the hosted
schema grants. The Node suite also executes this script locally. Hosted PostgREST,
Deno/npm resolution, gateway/CORS and actual MetaMask browser behavior must still
be verified after deployment. Those are not claimed as tested without credentials.
