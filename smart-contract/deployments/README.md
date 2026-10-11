# Public Deployment Records

The team reports a successful Ignition deployment to Sepolia, Campaign `0` (`test1`) creation and frontend Detail reads. See [sepolia.json](sepolia.json) for the shared address.

Deployment transaction hash, block, source commit and actual deployment ID are unconfirmed (`null`). Fill them from the original receipt/journal without guessing. This handoff is not independent chain or source-verification evidence.

Preserve the previous public record under a versioned filename before updating the shared deployment. Keep source, generated ABI, address and frontend configuration aligned. New contracts do not inherit old campaigns or funds.

Ignition journals live locally in `ignition/deployments/<deployment-id>/` and are Git-ignored. Default ID: `chain-11155111`; the original ID must still be confirmed. Preserve journals for resumption; use a new ID for an intentional new version, without manually altering journals.

Never include private keys, seed phrases or authenticated RPC URLs. See the root [README](../../README.md) for commands and collaboration steps.
