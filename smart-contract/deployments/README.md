# Public Deployment Records

The team reports a successful Ignition deployment to Sepolia, Campaign `0` (`test1`) creation and frontend Detail reads. See [sepolia.json](sepolia.json) for the shared address.

Deployment transaction hash, block, source commit and actual deployment ID are unconfirmed (`null`). Fill them from the original receipt/journal without guessing. This handoff is not independent chain or source-verification evidence.

Preserve the previous public record under a versioned filename before updating the shared deployment. Keep source, generated ABI, address and frontend configuration aligned. New contracts do not inherit old campaigns or funds.

Ignition journals live locally in `ignition/deployments/<deployment-id>/` and are Git-ignored. Default ID: `chain-11155111`; the original ID must still be confirmed. Preserve journals for resumption; use a new ID for an intentional new version, without manually altering journals.

Never include private keys, seed phrases or authenticated RPC URLs. See the root [README](../../README.md) for commands and collaboration steps.

V2 preparation: `ignition/modules/Crowdfunding.ts` now uses `CrowdfundingV2Module`
and explicitly deploys from account 0, which becomes owner in the constructor.
V2 is not deployed. Do not resume a V1 deployment journal to deploy V2. Use a new
explicit deployment ID and record the new address/block/transaction separately.
`sepolia.json` remains the V1 record; do not overwrite it. The ABI exporter writes
`frontend/src/contracts/CrowdfundingV2.json`; existing React services still import
V1 `Crowdfunding.json`. Switch ABI, address and deployment block together only after
review and deployment. No campaigns, balances or history migrate automatically.
