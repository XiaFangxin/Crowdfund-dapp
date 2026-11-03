const prefix = "crowdfund.pending:";
const memory = new Map();
export function pendingKey(chainId, address, account) {
  return `${prefix}${chainId}:${address.toLowerCase()}:${account.toLowerCase()}`;
}
function storage() {
  try { return globalThis.localStorage; } catch { return null; }
}
export function readPending(key) {
  if (memory.get(key)?.volatile) return memory.get(key);
  const raw = storage()?.getItem(key);
  if (!raw) return memory.get(key) ?? null;
  const record = JSON.parse(raw);
  if (!/^0x[0-9a-f]{64}$/i.test(record.hash) || typeof record.method !== "string") throw new Error("Invalid saved transaction. Check wallet activity before continuing.");
  return record;
}
export function assertPendingStorage(key) {
  const target = storage();
  if (!target) throw new Error("Browser storage is unavailable. Enable local storage before sending transactions so pending hashes can be recovered.");
  const probe = `${key}:probe`;
  target.setItem(probe, "1"); target.removeItem(probe);
}
export function savePending(key, record) {
  memory.set(key, record);
  try { storage().setItem(key, JSON.stringify(record)); }
  catch { memory.set(key, {...record,volatile:true}); }
  globalThis.dispatchEvent?.(new Event("crowdfund:pending"));
}
export function clearPending(key) {
  storage()?.removeItem(key);
  memory.delete(key);
  globalThis.dispatchEvent?.(new Event("crowdfund:pending"));
}
