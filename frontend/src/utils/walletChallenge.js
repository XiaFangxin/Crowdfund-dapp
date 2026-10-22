import { getAddress } from "ethers";
export function validateLoginChallenge(challenge,wallet,chainId,origin,now=Date.now()) {
  const message=challenge?.message;
  const fields=typeof message==="string" ? message.match(/\nNonce: ([a-f0-9]{64})\nIssued At: ([^\n]+)\nExpiration Time: ([^\n]+)$/):null;
  if(!fields)throw new Error("Server did not return a recognized SIWE challenge.");
  const [,nonce,issued,expires]=fields;
  const issuedTime=Date.parse(issued),expiry=Date.parse(expires);
  if(!Number.isFinite(issuedTime) || !Number.isFinite(expiry) || expiry<=now || issuedTime>now+5000 || expiry-issuedTime>301000 || challenge.expiresAt!==expires)throw new Error("Invalid or expired sign-in challenge.");
  const expected=`${new URL(origin).host} wants you to sign in with your Ethereum account:\n${getAddress(wallet)}\n\nSign in to Crowdfund off-chain interactions. This is not a transaction and costs no gas.\n\nURI: ${origin}/\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${expires}`;
  if(message!==expected)throw new Error("Sign-in challenge does not match this domain, wallet or chain.");
  return message;
}
