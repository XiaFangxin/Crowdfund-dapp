import { getAddress, verifyMessage } from "ethers";
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function fail(status, message) { throw new HttpError(status, message); }
export function address(value) {
  try { const result = getAddress(value).toLowerCase(); if (/^0x0{40}$/.test(result)) throw new Error(); return result; }
  catch { fail(400, "Invalid wallet or contract address."); }
}
export function campaignKey(input) {
  const chainId = Number(input?.chainId);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) fail(400, "Invalid chain ID.");
  const contractAddress = address(input?.contractAddress);
  const id = String(input?.campaignId ?? "");
  if (!/^(0|[1-9][0-9]{0,77})$/.test(id) || BigInt(id) >= 2n ** 256n) fail(400, "Invalid campaign ID.");
  return { chainId, contractAddress, campaignId: id };
}
export function text(value, max, label) {
  if (typeof value !== "string" || !value.trim() || [...value].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(400, `Invalid ${label}.`);
  return value.trim();
}
export function uuid(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail(400, "Invalid record ID.");
  return value.toLowerCase();
}
export function page(input) {
  const offset = input.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) fail(400, "Invalid page offset.");
  return { offset, limit: 20 };
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
}
export async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), n => n.toString(16).padStart(2, "0")).join("");
}
export function bearer(request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) fail(401, "Sign in with your wallet first.");
  return token;
}
export function buildChallenge({ wallet, origin, chainId, nonce, issuedAt, expiresAt }) {
  const domain = new URL(origin).host;
  return `${domain} wants you to sign in with your Ethereum account:\n${getAddress(wallet)}\n\nSign in to Crowdfund off-chain interactions. This is not a transaction and costs no gas.\n\nURI: ${origin}/\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expiresAt}`;
}
export function verifyChallenge(challenge, signature, origin, now = Date.now()) {
  if (!challenge || !Number.isFinite(Date.parse(challenge.expires_at)) || !Number.isFinite(Date.parse(challenge.issued_at)) || !/^[a-f0-9]{64}$/.test(challenge.nonce) || challenge.consumed_at || challenge.origin !== origin || Date.parse(challenge.expires_at) <= now || Date.parse(challenge.issued_at) > now + 5000) fail(401, "Challenge expired, consumed, or belongs to another origin.");
  const expected = buildChallenge({wallet:challenge.wallet,origin:challenge.origin,chainId:challenge.chain_id,nonce:challenge.nonce,issuedAt:challenge.issued_at,expiresAt:challenge.expires_at});
  // Never accept a client-supplied message or a recovered address as an arbitrary identity.
  if (challenge.message !== expected) fail(401, "Invalid challenge binding.");
  let recovered;
  try { recovered = verifyMessage(expected, signature).toLowerCase(); }
  catch { fail(401, "Invalid wallet signature."); }
  if (recovered !== challenge.wallet) fail(401, "Signature does not match the challenged wallet.");
  return recovered;
}
export function permittedOrigin(request, origins) {
  const origin = request.headers.get("origin");
  if (!origin || !origins.includes(origin)) fail(403, "Origin is not allowed.");
  return origin;
}
