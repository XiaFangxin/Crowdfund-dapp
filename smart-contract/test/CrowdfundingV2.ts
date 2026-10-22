import { expect } from "chai";
import { network } from "hardhat";
const { ethers, networkHelpers: h } = await network.create();
async function fixture() {
  const [owner, creator, donor] = await ethers.getSigners();
  const c = await ethers.deployContract("Crowdfunding");
  const deadline = (await h.time.latest()) + 1000;
  await c.connect(creator).createCampaign("A", "", 100, deadline, 0);
  await c.connect(creator).createCampaign("B", "", 100, deadline, 0);
  return { c, owner, creator, donor, deadline };
}
describe("V2 permissions and interfaces", function () {
  it("uses two-step ownership and revokes former owner", async function () {
    const { c, owner, creator, donor } = await h.loadFixture(fixture);
    expect(await c.owner()).to.equal(owner.address);
    await expect(c.connect(donor).transferOwnership(creator.address)).to.be.revertedWith("Only owner");
    for (const address of [ethers.ZeroAddress, owner.address]) await expect(c.transferOwnership(address)).to.be.revertedWith("Invalid owner");
    await expect(c.transferOwnership(creator.address)).to.emit(c, "OwnershipTransferStarted");
    expect(await c.owner()).to.equal(owner.address);
    await c.transferOwnership(donor.address);
    await expect(c.connect(creator).acceptOwnership()).to.be.revertedWith("Only pending owner");
    await expect(c.connect(donor).acceptOwnership()).to.emit(c, "OwnershipTransferred").withArgs(owner.address, donor.address);
    expect(await c.pendingOwner()).to.equal(ethers.ZeroAddress);
    await expect(c.setCampaignPaused(0, true)).to.be.revertedWith("Only owner");
    await c.connect(donor).setCampaignPaused(0, true);
  });
  it("pauses only new donations on the selected campaign and resumes", async function () {
    const { c, donor } = await h.loadFixture(fixture);
    expect(await c.campaignPaused(0)).to.equal(false);
    await expect(c.connect(donor).setCampaignPaused(0, true)).to.be.revertedWith("Only owner");
    await expect(c.setCampaignPaused(99, true)).to.be.revertedWith("Campaign not found");
    await expect(c.setCampaignPaused(0, true)).to.emit(c, "CampaignPauseChanged").withArgs(0, true);
    await expect(c.setCampaignPaused(0, true)).to.be.revertedWith("Pause unchanged");
    await expect(c.contribute(0, { value: 1 })).to.be.revertedWith("Campaign paused");
    await c.contribute(1, { value: 1 });
    await c.setCampaignPaused(0, false);
    await c.contribute(0, { value: 1 });
  });
  it("isolates balances, permits paused payouts/refunds and denies owner custody", async function () {
    const { c, creator, donor, deadline } = await h.loadFixture(fixture);
    await c.connect(donor).contribute(0, { value: 100 });
    await c.connect(donor).contribute(1, { value: 12 });
    await c.setCampaignPaused(0, true); await c.setCampaignPaused(1, true);
    await h.time.increaseTo(deadline);
    await expect(c.withdraw(0)).to.be.revertedWith("Only creator");
    await expect(c.refund(1)).to.be.revertedWith("Nothing to refund");
    await expect(c.connect(creator).withdraw(0)).to.changeEtherBalances(ethers, [c, creator], [-100n, 100n]);
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(12n);
    await expect(c.connect(donor).refund(1)).to.changeEtherBalances(ethers, [c, donor], [-12n, 12n]);
  });
  it("allows only creators to change presentation and publish event history even after deadline", async function () {
    const { c, owner, creator, donor, deadline } = await h.loadFixture(fixture);
    expect(await c.getCampaignMetadataURI(0)).to.equal("");
    const before = await c.getCampaign(0);
    for (const account of [owner, donor]) for (const method of ["setCampaignMetadataURI", "publishCampaignUpdate"])
      await expect(c.connect(account)[method](0, "ipfs://content")).to.be.revertedWith("Only creator");
    await c.setCampaignPaused(0, true); await h.time.increaseTo(deadline);
    await expect(c.connect(creator).setCampaignMetadataURI(0, "ipfs://v1")).to.emit(c, "CampaignMetadataUpdated").withArgs(0, "ipfs://v1");
    await c.connect(creator).setCampaignMetadataURI(0, "ipfs://v2");
    expect(await c.getCampaignMetadataURI(0)).to.equal("ipfs://v2");
    expect(await c.getCampaignMetadataURI(1)).to.equal("");
    expect(await c.getCampaign(0)).to.deep.equal(before);
    for (const uri of ["ipfs://u1", "https://example.org/u2"])
      await expect(c.connect(creator).publishCampaignUpdate(0, uri)).to.emit(c, "CampaignUpdatePublished").withArgs(0, creator.address, uri);
    const logs = await c.queryFilter(c.filters.CampaignUpdatePublished(0, creator.address));
    expect(logs.map(log => log.args.updateURI)).to.deep.equal(["ipfs://u1", "https://example.org/u2"]);
  });
  it("validates URI byte limits, schemes, characters and campaign IDs", async function () {
    const { c, creator } = await h.loadFixture(fixture);
    for (const method of ["setCampaignMetadataURI", "publishCampaignUpdate"]) {
      for (const uri of ["", "ipfs://" + "a".repeat(2042)]) await expect(c.connect(creator)[method](0, uri)).to.be.revertedWith("Invalid URI length");
      for (const uri of ["ipfs://", "https://", "http://example.org", "javascript:alert(1)"]) await expect(c.connect(creator)[method](0, uri)).to.be.revertedWith("Unsupported URI");
      for (const uri of ["ipfs://a b", "https://a\n", "ipfs://a\u007f", "ipfs://\u4e2d"]) await expect(c.connect(creator)[method](0, uri)).to.be.revertedWith("Invalid URI character");
      await c.connect(creator)[method](0, "ipfs://" + "a".repeat(2041));
      await c.connect(creator)[method](0, "https://example.org/a%20b");
      await expect(c.connect(creator)[method](99, "ipfs://valid")).to.be.revertedWith("Campaign not found");
    }
    await expect(c.getCampaignMetadataURI(99)).to.be.revertedWith("Campaign not found");
  });
});

describe("V2 adversarial transfers", function () {
  for (const refundMode of [false, true]) {
    it(`rolls back rejected ${refundMode ? "refund" : "withdrawal"} and blocks reentry on retry`, async function () {
      const { c, deadline } = await h.loadFixture(fixture);
      const receiver = await ethers.deployContract("AdversarialReceiver", [await c.getAddress()]);
      const receiverAddress = await receiver.getAddress();
      let id = 0;
      if (refundMode) {
        await receiver.donate(0, { value: 10 });
      } else {
        await receiver.create(10, deadline);
        id = 2;
        await c.contribute(id, { value: 10 });
      }
      // Another campaign's balance must survive every failed/successful payout.
      await c.contribute(1, { value: 23 });
      await h.time.increaseTo(deadline);
      await expect(receiver.collect(refundMode, true)).to.be.revertedWith("Transfer failed");
      expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(33n);
      if (refundMode) expect(await c.contributions(id, receiverAddress)).to.equal(10n);
      else expect((await c.getCampaign(id)).withdrawn).to.equal(false);
      await expect(receiver.collect(refundMode, false)).to.changeEtherBalances(ethers, [c, receiver], [-10n, 10n]);
      expect(await receiver.reentrySucceeded()).to.equal(false);
      expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(23n);
      await expect(receiver.collect(refundMode, false)).to.be.revertedWith(refundMode ? "Nothing to refund" : "Already withdrawn");
    });
  }
});

describe("V2 exact deadline boundaries", function () {
  it("allows withdrawal exactly at deadline and rejects contributions afterward", async function () {
    const { c, creator, deadline } = await h.loadFixture(fixture);
    await c.contribute(0, { value: 100 });
    await h.time.setNextBlockTimestamp(deadline);
    await expect(c.connect(creator).withdraw(0)).to.emit(c, "Withdrawn").withArgs(0, creator.address, 100);
    await expect(c.contribute(0, { value: 1 })).to.be.revertedWith("Campaign ended");
    await expect(c.connect(creator).withdraw(0)).to.be.revertedWith("Already withdrawn");
  });
  it("allows refund exactly at deadline and rejects nonexistent payout IDs", async function () {
    const { c, donor, deadline } = await h.loadFixture(fixture);
    await c.connect(donor).contribute(0, { value: 1 });
    await h.time.setNextBlockTimestamp(deadline);
    await expect(c.connect(donor).refund(0)).to.emit(c, "Refunded").withArgs(0, donor.address, 1);
    await expect(c.connect(donor).refund(0)).to.be.revertedWith("Nothing to refund");
    await expect(c.withdraw(99)).to.be.revertedWith("Campaign not found");
    await expect(c.refund(99)).to.be.revertedWith("Campaign not found");
  });
});
