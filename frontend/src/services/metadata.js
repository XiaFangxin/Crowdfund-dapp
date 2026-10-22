export function validateURI(uri) {
  if (typeof uri !== "string" || uri.length > 2048 || !/^(ipfs:\/\/|https:\/\/)[!-~]+$/.test(uri) || /[^!-~]/.test(uri)) throw new Error("Use an IPFS or HTTPS URI (1-2048 ASCII bytes, no spaces).");
  return uri;
}
export function contentURL(uri) {
  validateURI(uri);
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice(7);
    if (!/^[a-zA-Z0-9]+(?:\/[!-~]*)?$/.test(path) || path.includes("..") || /[?#\\]/.test(path)) throw new Error("Invalid IPFS content path.");
    return `https://ipfs.io/ipfs/${path}`;
  }
  const url = new URL(uri);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !host || url.username || url.password || url.port || !host.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host) || host.endsWith(".local") || host.endsWith(".localhost") || /^[\d.]+$/.test(host) || host.includes(":")) throw new Error("Use a public HTTPS URL without credentials, custom ports or IP literals.");
  return url.href;
}
function text(value, name, max, required = true) {
  if (typeof value !== "string" || value.length > max || (required && !value.length)) throw new Error(`Invalid ${name}.`);
  return value;
}
export function validateDocument(doc, kind = "metadata") {
  if (!doc || typeof doc !== "object" || Array.isArray(doc) || doc.schemaVersion !== "1.0") throw new Error("Expected a JSON object with schemaVersion 1.0.");
  if (kind === "metadata") return {schemaVersion:"1.0", image:contentURL(doc.image), summary:text(doc.summary,"summary",500), additionalDescription:text(doc.additionalDescription,"additionalDescription",20000,false)};
  if (!Array.isArray(doc.images) || doc.images.length > 10 || typeof doc.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(doc.publishedAt) || !Number.isFinite(Date.parse(doc.publishedAt))) throw new Error("Invalid update images or publishedAt.");
  if (doc.previousUpdateURI !== undefined) contentURL(doc.previousUpdateURI);
  return {schemaVersion:"1.0",title:text(doc.title,"title",160),body:text(doc.body,"body",20000),images:doc.images.map(contentURL),publishedAt:doc.publishedAt};
}
export async function fetchDocument(uri, kind = "metadata", signal) {
  const timeout = AbortSignal.timeout(12000);
  const response = await fetch(contentURL(uri), {signal:signal ? AbortSignal.any([signal,timeout]) : timeout, credentials:"omit",referrerPolicy:"no-referrer",redirect:"error",headers:{Accept:"application/json"}});
  if (!response.ok) throw new Error(`Content unavailable (${response.status}).`);
  if (!/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get("content-type") ?? "")) throw new Error("URI must serve application/json.");
  const limit = 256 * 1024;
  if (Number(response.headers.get("content-length")) > limit) throw new Error("JSON exceeds 256 KB.");
  const reader = response.body.getReader(); const parts=[]; let size=0;
  try { while (true) {const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>limit) throw new Error("JSON exceeds 256 KB."); parts.push(value);} }
  finally { await reader.cancel(); }
  const bytes=new Uint8Array(size); let offset=0; for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return validateDocument(JSON.parse(new TextDecoder().decode(bytes)),kind);
}
