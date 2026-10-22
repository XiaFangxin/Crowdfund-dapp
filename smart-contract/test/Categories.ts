import { expect } from "chai";
import { network } from "hardhat";
const { ethers, networkHelpers: h } = await network.create();
async function fixture() {
  const [owner, creator, donor] = await ethers.getSigners();
  const c = await ethers.deployContract("Crowdfunding");
  const deadline = (await h.time.latest()) + 1000;
  return { c, owner, creator, donor, deadline };
}
describe("V2 Category Registry", function () {
  it("initializes six stable enabled IDs and emits their registry events", async function () {
    const { c } = await h.loadFixture(fixture);
    const names = ["Education", "Charity", "Technology", "Creative", "Environment", "Community"];
    expect(await c.categoryCount()).to.equal(6n);
    const logs = await c.queryFilter(c.filters.CategoryAdded());
    expect(logs.length).to.equal(6);
    for (let id = 0; id < names.length; id++) {
      const category = await c.getCategory(id);
      expect(category.name).to.equal(names[id]); expect(category.active).to.equal(true);
      expect(logs[id].args.categoryId).to.equal(BigInt(id));
      expect(logs[id].args.name).to.equal(names[id]);
    }
  });
  it("limits every registry mutation to the current owner, including after ownership transfer", async function () {
    const { c, owner, creator, donor } = await h.loadFixture(fixture);
    for (const account of [creator, donor]) {
      await expect(c.connect(account).addCategory("Sports")).to.be.revertedWith("Only owner");
      await expect(c.connect(account).renameCategory(0, "Learning")).to.be.revertedWith("Only owner");
      await expect(c.connect(account).setCategoryActive(0, false)).to.be.revertedWith("Only owner");
    }
    await c.transferOwnership(creator.address);
    await expect(c.connect(creator).addCategory("Sports")).to.be.revertedWith("Only owner");
    await c.connect(creator).acceptOwnership();
    await expect(c.connect(owner).addCategory("Sports")).to.be.revertedWith("Only owner");
    await expect(c.connect(owner).renameCategory(0, "Learning")).to.be.revertedWith("Only owner");
    await expect(c.connect(owner).setCategoryActive(0, false)).to.be.revertedWith("Only owner");
    await c.connect(creator).addCategory("Sports");
    await c.connect(creator).renameCategory(6, "Sport");
    await c.connect(creator).setCategoryActive(6, false);
    await c.connect(creator).setCategoryActive(6, true);
  });
  it("adds, renames, disables and restores without deleting or reusing IDs", async function () {
    const { c } = await h.loadFixture(fixture);
    expect(await c.addCategory.staticCall("Sports")).to.equal(6n);
    await expect(c.addCategory("Sports")).to.emit(c, "CategoryAdded").withArgs(6, "Sports");
    await expect(c.renameCategory(6, "Team Sports")).to.emit(c, "CategoryRenamed").withArgs(6, "Sports", "Team Sports");
    await expect(c.setCategoryActive(6, false)).to.emit(c, "CategoryStatusChanged").withArgs(6, false);
    await c.renameCategory(6, "Sport");
    expect((await c.getCategory(6)).active).to.equal(false);
    await expect(c.addCategory("Other")).to.emit(c, "CategoryAdded").withArgs(7, "Other");
    expect(await c.categoryCount()).to.equal(8n);
    expect((await c.getCategory(6)).name).to.equal("Sport");
    await expect(c.setCategoryActive(6, true)).to.emit(c, "CategoryStatusChanged").withArgs(6, true);
    expect((await c.getCategory(6)).active).to.equal(true);
  });
  it("validates names, unchanged mutations and nonexistent category IDs", async function () {
    const { c } = await h.loadFixture(fixture);
    for (const name of ["", "a".repeat(65)]) {
      await expect(c.addCategory(name)).to.be.revertedWith("Invalid category name length");
      await expect(c.renameCategory(0, name)).to.be.revertedWith("Invalid category name length");
    }
    for (const name of [" ", " Leading", "Trailing ", "Line\nBreak", "\u4e2d", "a\u007f"]) {
      await expect(c.addCategory(name)).to.be.revertedWith("Invalid category name");
      await expect(c.renameCategory(0, name)).to.be.revertedWith("Invalid category name");
    }
    await c.addCategory("a".repeat(64));
    await c.renameCategory(6, "b".repeat(64));
    await expect(c.renameCategory(0, "Education")).to.be.revertedWith("Name unchanged");
    await expect(c.setCategoryActive(0, true)).to.be.revertedWith("Category status unchanged");
    await expect(c.getCategory(99)).to.be.revertedWith("Category not found");
    await expect(c.renameCategory(99, "X")).to.be.revertedWith("Category not found");
    await expect(c.setCategoryActive(99, false)).to.be.revertedWith("Category not found");
    await expect(c.getCampaignCategoryId(0)).to.be.revertedWith("Campaign not found");
  });
  it("requires an enabled category for every creation, with no four-argument bypass", async function () {
    const { c, creator, deadline } = await h.loadFixture(fixture);
    await expect(c.createCampaign("A", "", 100, deadline, 6)).to.be.revertedWith("Category not found");
    await c.setCategoryActive(0, false);
    await expect(c.createCampaign("A", "", 100, deadline, 0)).to.be.revertedWith("Category inactive");
    const oldABI = new ethers.Interface(["function createCampaign(string,string,uint256,uint256)"]);
    await expect(creator.sendTransaction({ to: await c.getAddress(), data: oldABI.encodeFunctionData("createCampaign", ["Bypass", "", 100, deadline]) })).to.revert(ethers);
    expect(await c.campaignCount()).to.equal(0n);
    await c.setCategoryActive(0, true);
    await expect(c.connect(creator).createCampaign("A", "", 100, deadline, 0)).to.emit(c, "CampaignCategoryAssigned").withArgs(0, 0);
    expect(await c.getCampaignCategoryId(0)).to.equal(0n);
    await c.addCategory("New category");
    await c.connect(creator).createCampaign("B", "", 100, deadline, 6);
    expect(await c.getCampaignCategoryId(1)).to.equal(6n);
    expect((await c.getCampaign(0)).creator).to.equal(creator.address);
  });
  it("keeps historical category links and funding rules intact after disabling and renaming", async function () {
    const { c, creator, donor, deadline } = await h.loadFixture(fixture);
    await c.connect(creator).createCampaign("Success", "", 100, deadline, 0);
    await c.connect(creator).createCampaign("Failure", "", 100, deadline, 0);
    await c.setCategoryActive(0, false);
    await c.renameCategory(0, "Learning");
    await c.connect(donor).contribute(0, { value: 100 });
    await c.connect(donor).contribute(1, { value: 12 });
    await c.connect(creator).setCampaignMetadataURI(0, "ipfs://display");
    await c.connect(creator).publishCampaignUpdate(0, "ipfs://update");
    expect(await c.getCampaignCategoryId(0)).to.equal(0n);
    expect(await c.getCampaignCategoryId(1)).to.equal(0n);
    expect((await c.getCategory(0)).name).to.equal("Learning");
    expect((await c.getCategory(0)).active).to.equal(false);
    await h.time.increaseTo(deadline);
    await expect(c.withdraw(0)).to.be.revertedWith("Only creator");
    await expect(c.connect(creator).withdraw(0)).to.changeEtherBalances(ethers, [c, creator], [-100n, 100n]);
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(12n);
    await expect(c.connect(donor).refund(1)).to.changeEtherBalances(ethers, [c, donor], [-12n, 12n]);
    await expect(c.connect(creator).withdraw(0)).to.be.revertedWith("Already withdrawn");
    await expect(c.connect(donor).refund(1)).to.be.revertedWith("Nothing to refund");
    expect(await c.getCampaignCategoryId(0)).to.equal(0n);
  });
});
