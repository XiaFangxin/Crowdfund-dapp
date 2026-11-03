import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const account = "0x0000000000000000000000000000000000000002";
const wallet = { ethereum: { request() { throw new Error("SSR must not request a wallet"); } }, account, chainId: 11155111, isSepolia: true, revision: 0, busy: false };
const state = (fields = {}) => ({ data: null, loading: false, error: "", reload() { throw new Error("Rendering must not refresh data"); }, ...fields });
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
const statValues = (html, className) => [...html.matchAll(new RegExp(`<div class="${className}">[\\s\\S]*?<strong>([\\s\\S]*?)<\\/strong>`, "g"))].map(match => match[1]);

async function withPages(run) {
  const env = {
    VITE_CROWDFUNDING_VERSION: "v1",
    VITE_CROWDFUNDING_ADDRESS: "0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C",
    VITE_CROWDFUNDING_DEPLOY_BLOCK: "0",
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_PUBLISHABLE_KEY: "",
    VITE_SUPABASE_ANON_KEY: "",
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  let server;
  try {
    server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: "automatic" }, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
    const { default: Profile } = await server.ssrLoadModule("/src/pages/Profile.jsx");
    const { default: MyContributions } = await server.ssrLoadModule("/src/pages/MyContributions.jsx");
    await run({ Profile, MyContributions });
  } finally {
    await server?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Profile keeps wrong-network values unavailable and connects each tab to its panel", async () => {
  await withPages(({ Profile }) => {
    const html = render(Profile, { wallet: { ...wallet, chainId: 1, isSepolia: false } });
    assert.deepEqual(statValues(html, "profile-stat"), ["Unavailable", "Unavailable", "Unavailable"]);
    assert.ok(html.includes("Sepolia"));
    assert.ok(!html.includes("0.0 ETH"));
    assert.ok(!html.includes('class="campaign-grid"'));
    const tabIds = [...html.matchAll(/role="tab" id="([^"]+)" aria-controls="([^"]+)" aria-selected="(true|false)" tabindex="(-?\d+)"/g)];
    assert.equal(tabIds.length, 4);
    assert.equal(tabIds.filter(tab => tab[3] === "true" && tab[4] === "0").length, 1);
    assert.equal(tabIds.filter(tab => tab[3] === "false" && tab[4] === "-1").length, 3);
    for (const tab of tabIds) {
      assert.ok(html.includes(`role="tabpanel" id="${tab[2]}" aria-labelledby="${tab[1]}"`));
    }
    assert.equal((html.match(/role="tabpanel"[^>]* hidden=""/g) ?? []).length, 3);
  });
});

test("Profile initial connected render presents pending data instead of empty results", async () => {
  await withPages(({ Profile }) => {
    const html = render(Profile, { wallet });
    const values = statValues(html, "profile-stat");
    assert.equal(values.length, 3);
    assert.ok(values.every(value => /Loading/.test(value)));
    assert.ok(html.includes('class="list-state" role="status"'));
    assert.ok(html.includes('aria-busy="true"'));
    assert.ok(!html.includes("0.0 ETH"));
    assert.ok(!html.includes("No transactions yet"));
    assert.ok(!html.includes("No refunds available"));
    assert.ok(!html.includes("created a campaign yet"));
  });
});

test("provided history keeps loading and failed requests distinct from a complete empty history", async () => {
  await withPages(({ MyContributions }) => {
    const props = { wallet, campaigns: [], embedded: true };
    const pending = render(MyContributions, { ...props, history: state({ loading: true }) });
    assert.ok(pending.includes('aria-busy="true"'));
    assert.ok(statValues(pending, "contributions-stat").every(value => /Loading/.test(value)));
    assert.ok(!pending.includes("No transactions yet"));
    assert.ok(!pending.includes("<table"));
    const error = "RPC <unavailable>";
    const failed = render(MyContributions, { ...props, history: state({ error }) });
    assert.ok(failed.includes('role="alert"'));
    assert.ok(failed.includes("RPC &lt;unavailable&gt;"));
    assert.deepEqual(statValues(failed, "contributions-stat"), ["Unavailable", "Unavailable", "Unavailable"]);
    assert.ok(!failed.includes("No transactions yet"));
    assert.ok(!failed.includes("<table"));
    const empty = render(MyContributions, { ...props, history: state({ data: [] }) });
    assert.deepEqual(statValues(empty, "contributions-stat"), ["0.0 ETH", "0", "0.0 ETH"]);
    assert.ok(empty.includes("No transactions yet"));
    assert.ok(!empty.includes('role="alert"'));
    assert.ok(!empty.includes("<table"));
  });
});

test("complete supplied history renders exact lifetime totals, campaign zero and accessible explorer links", async () => {
  await withPages(({ MyContributions }) => {
    const hash = `0x${"a".repeat(64)}`;
    const entry = (id, type, campaignId, amountWei) => ({ id, type, campaignId, amountWei, transactionHash: hash, timestamp: 1700000000 });
    const data = [
      entry("donation-1", "Donation", "0", 1000000000000000001n),
      entry("donation-2", "Donation", "0", 2000000000000000002n),
      entry("donation-3", "Donation", "99", 4n),
      entry("refund", "Refund", "0", 1000000000000000001n),
      entry("withdrawal", "Withdrawal", "0", 99000000000000000000n),
      entry("created", "Created", "0", 0n),
    ];
    const html = render(MyContributions, { wallet, campaigns: [{ id: "0", title: "Garden <script>" }], history: state({ data }), embedded: true });
    assert.deepEqual(statValues(html, "contributions-stat"), ["3.000000000000000007 ETH", "2", "1.000000000000000001 ETH"]);
    assert.ok(html.includes('href="#/campaign/0"'));
    assert.ok(html.includes("Garden &lt;script&gt;"));
    assert.ok(!html.includes("Garden <script>"));
    assert.ok(html.includes("Campaign #99"));
    assert.equal((html.match(/<th scope="col">/g) ?? []).length, 5);
    assert.equal((html.match(/<time dateTime="/g) ?? []).length, data.length);
    assert.equal((html.match(new RegExp(`href="https://sepolia.etherscan.io/tx/${hash}"`, "g")) ?? []).length, data.length);
    assert.ok(html.includes(`aria-label="View transaction ${hash}`));
    assert.ok(!html.includes('role="alert"'));
  });
});

test("a supplied history cannot expose stale transaction values on the wrong network", async () => {
  await withPages(({ MyContributions }) => {
    const html = render(MyContributions, {
      wallet: { ...wallet, chainId: 1, isSepolia: false }, campaigns: [], embedded: true,
      history: state({ data: [{ id: "stale", type: "Donation", campaignId: "0", amountWei: 1000000000000000000n, transactionHash: "0xstale", timestamp: 1700000000 }] }),
    });
    assert.deepEqual(statValues(html, "contributions-stat"), ["Unavailable", "Unavailable", "Unavailable"]);
    assert.ok(!html.includes("0xstale"));
    assert.ok(!html.includes("<table"));
    assert.ok(!html.includes("No transactions yet"));
  });
});
