import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const now = 2_000_000_000;
const account = "0x0000000000000000000000000000000000000002";
const hash = `0x${"a".repeat(64)}`;

function buttonDisabled(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<button\\b([^>]*)>${escaped}</button>`));
  assert.ok(match, `Expected the ${label} button`);
  return /\bdisabled(?:=|\s|$)/.test(match[1]);
}

test("campaign detail blocks unresolved transactions while retaining normal retry and wallet guards", async t => {
  const settings = {
    VITE_CROWDFUNDING_VERSION: "v2",
    VITE_CROWDFUNDING_V2_ADDRESS: "0x0000000000000000000000000000000000000001",
    VITE_CROWDFUNDING_V2_DEPLOY_BLOCK: "0",
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_PUBLISHABLE_KEY: "",
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  let server;
  try {
    server = await createServer({
      configFile: false,
      envFile: false,
      esbuild: { jsx: "automatic" },
      server: { middlewareMode: true, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
      plugins: [{
        name: "detail-transaction-scenarios",
        enforce: "pre",
        resolveId(source) {
          if (source === "virtual:detail-scenario") return "\0detail-scenario";
          if (/\/hooks\/useResource\.js$/.test(source)) return "\0detail-resource";
          if (/\/hooks\/useTransaction\.js$/.test(source)) return "\0detail-transaction";
          if (/\/hooks\/useNow\.js$/.test(source)) return "\0detail-now";
        },
        load(id) {
          if (id === "\0detail-scenario") return `
            export let scenario;
            let resourceIndex = 0;
            export function setScenario(value) { scenario = value; resourceIndex = 0; }
            export function resourceData() {
              return resourceIndex++ === 0
                ? { campaign: scenario.campaign, contribution: scenario.contribution }
                : [];
            }
          `;
          if (id === "\0detail-resource") return `
            import { resourceData } from "virtual:detail-scenario";
            export default function useResource() {
              return { data: resourceData(), loading: false, error: "", reload() {} };
            }
          `;
          if (id === "\0detail-transaction") return `
            import { scenario } from "virtual:detail-scenario";
            export default function useTransaction() {
              return { status: scenario.status, hash: scenario.hash, error: scenario.error,
                busy: false, run() { throw new Error("No real transaction may run in a render test."); } };
            }
          `;
          if (id === "\0detail-now") return `export default function useNow() { return ${now}; }`;
        },
      }],
    });
    const { setScenario } = await server.ssrLoadModule("virtual:detail-scenario");
    const { default: CampaignDetail } = await server.ssrLoadModule("/src/pages/CampaignDetail.jsx");
    const wallet = {
      ethereum: { request() { throw new Error("No chain requests are allowed in this test."); } },
      account, chainId: 11155111, isSepolia: true, revision: 0, busy: false,
    };
    const campaign = {
      id: "0", creator: account, title: "Community library", description: "Books for everyone.",
      goal: 1_000_000_000_000_000_000n, amountRaised: 500_000_000_000_000_000n,
      deadline: now + 3600, withdrawn: false, paused: false, metadataURI: "", categoryId: "0",
      category: { name: "Education", active: true },
    };
    function render({ status = "idle", changes = {}, walletChanges = {} } = {}) {
      setScenario({
        campaign: { ...campaign, ...changes }, contribution: 100_000_000_000_000_000n,
        status, hash: status === "unknown" ? hash : "",
        error: status === "unknown" ? "Confirmation is unavailable." : "",
      });
      return renderToStaticMarkup(createElement(CampaignDetail, { id: "0", wallet: { ...wallet, ...walletChanges } }));
    }

    await t.test("an active campaign accepts donations and a rejected request remains retryable", () => {
      for (const status of ["idle", "rejected"]) {
        const html = render({ status });
        assert.equal(buttonDisabled(html, "Contribute"), false);
        assert.equal(buttonDisabled(html, "Update metadata"), false);
        assert.equal(buttonDisabled(html, "Publish update"), false);
      }
    });

    await t.test("unknown confirmation locks donation and creator writes without losing its hash", () => {
      const html = render({ status: "unknown" });
      for (const label of ["Contribute", "Update metadata", "Publish update"]) {
        assert.equal(buttonDisabled(html, label), true, label);
      }
      assert.ok(html.includes(`href="https://sepolia.etherscan.io/tx/${hash}"`));
      assert.match(html, /may still be pending or already confirmed/);
      assert.match(html, /Campaign actions are locked on this page while confirmation is unknown/);
      assert.match(html, /role="alert"[^>]*>Your transaction/);
    });

    await t.test("an eligible refund is enabled normally and disabled while confirmation is unknown", () => {
      const changes = { deadline: now - 1 };
      assert.equal(buttonDisabled(render({ changes }), "Refund 0.1 ETH"), false);
      assert.equal(buttonDisabled(render({ changes, status: "unknown" }), "Refund 0.1 ETH"), true);
    });

    await t.test("an eligible withdrawal is disabled while confirmation is unknown", () => {
      const changes = { deadline: now - 1, amountRaised: campaign.goal };
      assert.equal(buttonDisabled(render({ changes }), "Withdraw"), false);
      assert.equal(buttonDisabled(render({ changes, status: "unknown" }), "Withdraw"), true);
    });

    await t.test("disconnected, wrong-network and missing-provider wallets cannot donate", () => {
      for (const walletChanges of [
        { account: "" },
        { isSepolia: false, chainId: 1 },
        { ethereum: null },
      ]) assert.equal(buttonDisabled(render({ walletChanges }), "Contribute"), true);
    });
  } finally {
    await server?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
