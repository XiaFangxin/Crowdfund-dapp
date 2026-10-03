import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

async function fixture() {
  const [creator, alice, bob] = await ethers.getSigners();
  const crowdfunding = await ethers.deployContract("Crowdfunding");
  await crowdfunding.waitForDeployment();
  const deadline = (await networkHelpers.time.latest()) + 3600;
  const goal = ethers.parseEther("1");
  await crowdfunding.createCampaign("Community garden", "Demo campaign", goal, deadline);
  return { crowdfunding, creator, alice, bob, deadline, goal };
}

describe("Crowdfunding", function () {
  it("creates a campaign and emits its ID", async function () {
    const { crowdfunding, creator, deadline, goal } = await networkHelpers.loadFixture(fixture);
    expect(await crowdfunding.campaignCount()).to.equal(1n);
    const campaign = await crowdfunding.getCampaign(0);
    expect(campaign.creator).to.equal(creator.address);
    expect(campaign.title).to.equal("Community garden");
    expect(campaign.description).to.equal("Demo campaign");
    expect(campaign.goal).to.equal(goal);
    expect(campaign.deadline).to.equal(BigInt(deadline));
    expect(campaign.amountRaised).to.equal(0n);
    await expect(crowdfunding.createCampaign("Second", "", goal, deadline))
      .to.emit(crowdfunding, "CampaignCreated").withArgs(1n, creator.address, "Second", goal, deadline);
  });

  it("rejects invalid campaign data and nonexistent IDs", async function () {
    const { crowdfunding, deadline, goal } = await networkHelpers.loadFixture(fixture);
    await expect(crowdfunding.createCampaign("", "", goal, deadline)).to.be.revertedWith("Title required");
    await expect(crowdfunding.createCampaign("Test", "", 0, deadline)).to.be.revertedWith("Goal must be positive");
    await expect(crowdfunding.createCampaign("Test", "", goal, 1)).to.be.revertedWith("Deadline must be in future");
    await expect(crowdfunding.getCampaign(99)).to.be.revertedWith("Campaign not found");
    await expect(crowdfunding.contribute(99, { value: 1 })).to.be.revertedWith("Campaign not found");
  });

  it("accumulates contributions for each contributor", async function () {
    const { crowdfunding, alice, bob } = await networkHelpers.loadFixture(fixture);
    const value = ethers.parseEther("0.2");
    await expect(crowdfunding.connect(alice).contribute(0, { value }))
      .to.emit(crowdfunding, "Contributed").withArgs(0n, alice.address, value);
    await crowdfunding.connect(alice).contribute(0, { value });
    await crowdfunding.connect(bob).contribute(0, { value });
    expect(await crowdfunding.contributions(0, alice.address)).to.equal(value * 2n);
    expect(await crowdfunding.contributions(0, bob.address)).to.equal(value);
    expect((await crowdfunding.getCampaign(0)).amountRaised).to.equal(value * 3n);
  });

  it("rejects zero contributions and contributions at the deadline", async function () {
    const { crowdfunding, alice, deadline } = await networkHelpers.loadFixture(fixture);
    await expect(crowdfunding.connect(alice).contribute(0)).to.be.revertedWith("Contribution must be positive");
    await networkHelpers.time.setNextBlockTimestamp(deadline);
    await expect(crowdfunding.connect(alice).contribute(0, { value: 1 })).to.be.revertedWith("Campaign ended");
  });

  it("allows only the creator to withdraw a successful campaign once after the deadline", async function () {
    const { crowdfunding, creator, alice, deadline, goal } = await networkHelpers.loadFixture(fixture);
    await crowdfunding.connect(alice).contribute(0, { value: goal });
    await expect(crowdfunding.withdraw(0)).to.be.revertedWith("Campaign still active");
    await networkHelpers.time.increaseTo(deadline);
    await expect(crowdfunding.connect(alice).withdraw(0)).to.be.revertedWith("Only creator");
    await expect(crowdfunding.connect(alice).refund(0)).to.be.revertedWith("Goal reached");
    await expect(crowdfunding.withdraw(0)).to.changeEtherBalances(ethers, [crowdfunding, creator], [-goal, goal]);
    expect((await crowdfunding.getCampaign(0)).withdrawn).to.equal(true);
    await expect(crowdfunding.withdraw(0)).to.be.revertedWith("Already withdrawn");
  });

  it("refunds only the caller's contribution on failure and prevents double refunds", async function () {
    const { crowdfunding, alice, bob, deadline } = await networkHelpers.loadFixture(fixture);
    const value = ethers.parseEther("0.2");
    await crowdfunding.connect(alice).contribute(0, { value });
    await crowdfunding.connect(bob).contribute(0, { value });
    await expect(crowdfunding.connect(alice).refund(0)).to.be.revertedWith("Campaign still active");
    await networkHelpers.time.increaseTo(deadline);
    await expect(crowdfunding.withdraw(0)).to.be.revertedWith("Goal not reached");
    await expect(crowdfunding.connect(alice).refund(0)).to.changeEtherBalances(ethers, [crowdfunding, alice], [-value, value]);
    expect(await crowdfunding.contributions(0, alice.address)).to.equal(0n);
    expect(await crowdfunding.contributions(0, bob.address)).to.equal(value);
    expect((await crowdfunding.getCampaign(0)).amountRaised).to.equal(value * 2n);
    await expect(crowdfunding.connect(alice).refund(0)).to.be.revertedWith("Nothing to refund");
    await expect(crowdfunding.connect(bob).refund(0)).to.emit(crowdfunding, "Refunded").withArgs(0n, bob.address, value);
    expect(await ethers.provider.getBalance(await crowdfunding.getAddress())).to.equal(0n);
  });
});
