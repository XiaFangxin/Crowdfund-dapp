import test from "node:test";
import assert from "node:assert/strict";
import { profileCampaigns } from "../src/utils/profile.js";

const owner = "0x00000000000000000000000000000000000000aB";
const campaign = (id, fields = {}) => ({ id, creator: owner, deadline: 100, goal: 1000n, amountRaised: 100n, ...fields });

test("profile keeps unavailable contribution balances distinct from an empty result", () => {
  const pending = profileCampaigns([campaign("0")], owner.toLowerCase(), null, 100);
  assert.equal(pending.created.length, 1);
  assert.equal(pending.refundable, null);
  assert.equal(pending.totalRefundable, null);
  const empty = profileCampaigns([campaign("0")], owner, {}, 100);
  assert.deepEqual(empty.supported, []);
  assert.deepEqual(empty.refundable, []);
  assert.equal(empty.totalRefundable, 0n);
  assert.deepEqual(profileCampaigns([campaign("0")], "", {}, 100).created, []);
});

test("profile refunds exclude future, successful and already-refunded contributions", () => {
  const campaigns = [
    campaign("0", { paused: true }),
    campaign("1", { deadline: 101 }),
    campaign("2", { amountRaised: 1000n }),
    campaign("3", { withdrawn: true, amountRaised: 1200n }),
    campaign("4"),
  ];
  const state = profileCampaigns(campaigns, owner, { "0": 25n, "1": 30n, "2": 40n, "3": 50n, "4": 0n }, 100);
  assert.deepEqual(state.refundable.map(item => item.id), ["0"]);
  assert.equal(state.supported.length, 4);
  assert.equal(state.totalRefundable, 25n);
});

test("profile adds refundable wei exactly without converting money to Number", () => {
  const large = 9007199254740993123456789n;
  const state = profileCampaigns([campaign("0"), campaign("1", { creator: "another-wallet" })], owner, { "0": large, "1": 17n }, 101);
  assert.equal(state.totalRefundable, large + 17n);
  assert.deepEqual(state.created.map(item => item.id), ["0"]);
});
