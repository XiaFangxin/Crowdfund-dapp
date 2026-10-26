import test from "node:test";
import assert from "node:assert/strict";
import { formatEther } from "ethers";
import { validateCampaignForm } from "../src/utils/campaignForm.js";

// Local dates match datetime-local values regardless of the machine's timezone.
const deadline = "2030-05-17T14:30";
const deadlineMs = new Date(deadline).getTime();
const now = deadlineMs - 60_000;
const validInput = { title: "Community garden", description: "A shared garden.", goal: "0.1", deadline, categoryId: "" };
const validate = (input = {}, options = {}) => validateCampaignForm({ ...validInput, ...input }, { now, ...options });

test("normalization trims text and ETH while preserving the local deadline and string category ID", () => {
  const input = { title: "  Garden  ", description: "  Community project \n", goal: "  0001.2300  ", deadline, categoryId: 0 };
  const before = { ...input };
  const result = validate(input);
  assert.deepEqual(result.values, { title: "Garden", description: "Community project", goal: "0001.2300", deadline, categoryId: "0" });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(input, before);
});

test("title is required, description is optional, and trimmed character limits accept their boundaries", () => {
  assert.deepEqual(validate({ title: ` ${"t".repeat(120)} `, description: ` ${"d".repeat(2000)} ` }).errors, {});
  assert.deepEqual(validate({ description: " \n " }).errors, {});
  assert.match(validate({ title: "  " }).errors.title, /title/);
  const { errors } = validate({ title: "t".repeat(121), description: "d".repeat(2001) });
  assert.match(errors.title, /120/);
  assert.match(errors.description, /2,000/);
});

test("ETH validation rejects missing, nonpositive, shorthand and imprecise numeric formats", () => {
  for (const goal of ["", " ", "0", "0.000000000000000000", "-1", "+1", ".1", "1.", "1e-3", "NaN", "Infinity", "1,000", "0.0000000000000000001", "1 2"]) {
    assert.ok(validate({ goal }).errors.goal, `Expected an error for ${JSON.stringify(goal)}`);
  }
});

test("one wei and the exact uint256 maximum are valid without floating point conversion", () => {
  const maximumWei = (1n << 256n) - 1n;
  assert.deepEqual(validate({ goal: "0.000000000000000001" }).errors, {});
  assert.deepEqual(validate({ goal: formatEther(maximumWei) }).errors, {});
});

test("one wei above uint256 and extremely large decimal goals are rejected", () => {
  assert.match(validate({ goal: formatEther(1n << 256n) }).errors.goal, /maximum/);
  assert.match(validate({ goal: "9".repeat(1000) }).errors.goal, /maximum/);
});

test("deadlines must be valid and strictly future after conversion to chain seconds", () => {
  assert.match(validate({ deadline: "" }).errors.deadline, /valid/);
  assert.match(validate({ deadline: "not-a-date" }).errors.deadline, /valid/);
  assert.match(validate({}, { now: deadlineMs + 1 }).errors.deadline, /future/);
  assert.match(validate({}, { now: deadlineMs }).errors.deadline, /future/);
  assert.deepEqual(validate({}, { now: deadlineMs - 1 }).errors, {});
});

test("deadline validation uses the same floor-to-seconds rule as the transaction service", () => {
  const fractionalDeadline = `${deadline}:00.900`;
  assert.match(validate({ deadline: fractionalDeadline }, { now: deadlineMs + 500 }).errors.deadline, /future/);
  assert.deepEqual(validate({ deadline: `${deadline}:01` }, { now: deadlineMs + 999 }).errors, {});
});

test("V1 accepts a missing category while V2 accepts enabled category ID zero", () => {
  assert.deepEqual(validate().errors, {});
  const categories = [{ id: "0", active: true }, { id: "1", active: false }];
  assert.deepEqual(validate({ categoryId: 0 }, { isV2: true, categories }).errors, {});
  assert.deepEqual(validate({ categoryId: "0" }, { isV2: true, categories: [{ id: 0n, active: true }] }).errors, {});
});

test("V2 rejects missing, inactive, unknown and nonnumeric categories", () => {
  const options = { isV2: true, categories: [{ id: "0", active: true }, { id: "1", active: false }] };
  for (const categoryId of ["", "1", "2", "-1", "0.0", " 0 ", "00"]) {
    assert.match(validate({ categoryId }, options).errors.categoryId, /enabled/, categoryId);
  }
  assert.match(validate({ categoryId: "0" }, { isV2: true }).errors.categoryId, /enabled/);
});

test("validation returns all field errors together without requiring browser APIs", () => {
  const { values, errors } = validateCampaignForm({ description: "d".repeat(2001) }, { now, isV2: true });
  assert.deepEqual(Object.keys(errors).sort(), ["categoryId", "deadline", "description", "goal", "title"]);
  assert.deepEqual(values, { title: "", description: "d".repeat(2001), goal: "", deadline: "", categoryId: "" });
});
