import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrowdfundingV2Module", (m) => {
  const crowdfunding = m.contract("Crowdfunding", [], { from: m.getAccount(0) });
  return { crowdfunding };
});
