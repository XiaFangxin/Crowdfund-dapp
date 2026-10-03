import { readFile, writeFile } from "node:fs/promises";

const artifactPath = new URL("../artifacts/contracts/Crowdfunding.sol/Crowdfunding.json", import.meta.url);
const destination = new URL("../../frontend/src/contracts/Crowdfunding.json", import.meta.url);
const { abi } = JSON.parse(await readFile(artifactPath, "utf8"));
await writeFile(destination, JSON.stringify({ abi }, null, 2) + "\n");
console.log("Exported Crowdfunding ABI to frontend/src/contracts/Crowdfunding.json");
