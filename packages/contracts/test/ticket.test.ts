import assert from 'node:assert/strict';
import hre from 'hardhat';

const { viem } = hre;

async function expectRevert(action: () => Promise<unknown>) {
  let reverted = false;
  try {
    await action();
  } catch {
    reverted = true;
  }
  assert.equal(reverted, true, 'expected revert');
}

async function deployFixture() {
  const [owner, organizer, marketplace, validator, buyer, other] = await viem.getWalletClients();
  const nft = await viem.deployContract('TicketNFT', [organizer.account.address, marketplace.account.address, `0x${'11'.repeat(32)}`, 150, 500, 'https://example.com/tickets/', [
    { tierId: 1n, tierReference: `0x${'22'.repeat(32)}`, faceValue: 1000n, configuredSupply: 2n },
    { tierId: 2n, tierReference: `0x${'33'.repeat(32)}`, faceValue: 2000n, configuredSupply: 1n },
  ]]);
  const factory = await viem.deployContract('TicketFactory', [owner.account.address, owner.account.address]);
  return { owner, organizer, marketplace, validator, buyer, other, nft, factory };
}

describe('TicketNFT', () => {
  it('validates constructor inputs', async () => {
    const [owner] = await viem.getWalletClients();
    await expectRevert(() => viem.deployContract('TicketNFT', [owner.account.address, owner.account.address, `0x${'00'.repeat(32)}`, 100, 0, '', []]));
    await expectRevert(() => viem.deployContract('TicketNFT', [owner.account.address, owner.account.address, `0x${'11'.repeat(32)}`, 99, 0, 'https://example.com/tickets/', [{ tierId: 1n, tierReference: `0x${'22'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }]]));
    await expectRevert(() => viem.deployContract('TicketNFT', [owner.account.address, owner.account.address, `0x${'11'.repeat(32)}`, 151, 0, 'https://example.com/tickets/', [{ tierId: 1n, tierReference: `0x${'22'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }]]));
    await expectRevert(() => viem.deployContract('TicketNFT', [owner.account.address, owner.account.address, `0x${'11'.repeat(32)}`, 100, 1001, 'https://example.com/tickets/', [{ tierId: 1n, tierReference: `0x${'22'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }]]));
    await expectRevert(() => viem.deployContract('TicketNFT', [owner.account.address, owner.account.address, `0x${'11'.repeat(32)}`, 100, 0, 'https://example.com/tickets/', [{ tierId: 1n, tierReference: `0x${'22'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }, { tierId: 1n, tierReference: `0x${'33'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }]]));
  });

  it('mints, batches, exposes views, and finalizes', async () => {
    const { nft, organizer } = await deployFixture();
    await nft.write.mintBatch([1n, 1n], { account: organizer.account });
    await expectRevert(() => nft.write.finalizeMinting({ account: organizer.account }));
    await nft.write.mintBatch([1n, 1n], { account: organizer.account });
    await nft.write.mintBatch([2n, 1n], { account: organizer.account });
    assert.equal(await nft.read.tierOf([1n]), 1n);
    assert.equal(await nft.read.faceValue([1n]), 1000n);
    assert.equal(await nft.read.maxResalePrice([1n]), 1500n);
    assert.equal(await nft.read.tokenURI([1n]), 'https://example.com/tickets/1');
    const [receiver, royaltyAmount] = await nft.read.royaltyInfo([1n, 10_000n]);
    assert.equal(receiver.toLowerCase(), organizer.account.address.toLowerCase());
    assert.equal(royaltyAmount, 500n);
    await nft.write.finalizeMinting({ account: organizer.account });
    assert.equal(await nft.read.mintingFinalized(), true);
    await expectRevert(() => nft.write.mintBatch([1n, 1n], { account: organizer.account }));
    await expectRevert(() => nft.write.transferOwnership([organizer.account.address], { account: organizer.account }));
    await expectRevert(() => nft.write.renounceOwnership({ account: organizer.account }));
  });

  it('enforces minting and validator access control', async () => {
    const { nft, organizer, validator, buyer } = await deployFixture();
    await expectRevert(() => nft.write.mintBatch([1n, 1n], { account: buyer.account }));
    await expectRevert(() => nft.write.mintBatch([1n, 101n], { account: organizer.account }));
    await nft.write.mintBatch([1n, 2n], { account: organizer.account });
    await expectRevert(() => nft.write.mintBatch([1n, 1n], { account: organizer.account }));
    await expectRevert(() => nft.write.finalizeMinting({ account: buyer.account }));
    await expectRevert(() => nft.write.addValidator([validator.account.address], { account: buyer.account }));
    await nft.write.mintBatch([2n, 1n], { account: organizer.account });
    await nft.write.finalizeMinting({ account: organizer.account });
    await nft.write.addValidator([validator.account.address], { account: organizer.account });
    await nft.write.removeValidator([validator.account.address], { account: organizer.account });
    await expectRevert(() => nft.write.burn([1n], { account: validator.account }));
  });

  it('enforces dangerous transfer restrictions and validator burns', async () => {
    const { nft, organizer, marketplace, validator, buyer, other } = await deployFixture();
    await nft.write.mintBatch([1n, 2n], { account: organizer.account });
    await nft.write.mintBatch([2n, 1n], { account: organizer.account });
    await expectRevert(() => nft.write.transferFrom([organizer.account.address, buyer.account.address, 1n], { account: organizer.account }));
    await expectRevert(() => nft.write.burn([1n], { account: validator.account }));
    await nft.write.approve([marketplace.account.address, 1n], { account: organizer.account });
    await expectRevert(() => nft.write.transferFrom([organizer.account.address, marketplace.account.address, 1n], { account: marketplace.account }));
    await nft.write.finalizeMinting({ account: organizer.account });
    await nft.write.addValidator([validator.account.address], { account: organizer.account });
    await nft.write.transferFrom([organizer.account.address, buyer.account.address, 1n], { account: organizer.account });
    await expectRevert(() => nft.write.transferFrom([buyer.account.address, organizer.account.address, 1n], { account: buyer.account }));
    await expectRevert(() => nft.write.transferFrom([buyer.account.address, marketplace.account.address, 1n], { account: buyer.account }));
    await expectRevert(() => nft.write.transferFrom([buyer.account.address, buyer.account.address, 1n], { account: organizer.account }));
    await expectRevert(() => nft.write.transferFrom([buyer.account.address, organizer.account.address, 1n], { account: marketplace.account }));
    await nft.write.approve([marketplace.account.address, 1n], { account: buyer.account });
    await nft.write.transferFrom([buyer.account.address, marketplace.account.address, 1n], { account: marketplace.account });
    await nft.write.transferFrom([marketplace.account.address, other.account.address, 1n], { account: marketplace.account });
    await expectRevert(() => nft.write.transferFrom([other.account.address, buyer.account.address, 1n], { account: other.account }));
    await nft.write.burn([1n], { account: validator.account });
    await expectRevert(() => nft.write.burn([2n], { account: buyer.account }));
  });
});

describe('TicketFactory', () => {
  it('controls access, registry, rotation, and renounce disablement', async () => {
    const { owner, organizer, marketplace, factory } = await deployFixture();
    await expectRevert(() => factory.write.createEvent([organizer.account.address, marketplace.account.address, `0x${'44'.repeat(32)}`, 150, 500, 'https://example.com/tickets/', [{ tierId: 1n, tierReference: `0x${'55'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }]], { account: organizer.account }));
    await factory.write.setPlatformOrchestrator([organizer.account.address], { account: owner.account });
    await factory.write.createEvent([organizer.account.address, marketplace.account.address, `0x${'44'.repeat(32)}`, 150, 500, 'https://example.com/tickets/', [{ tierId: 1n, tierReference: `0x${'55'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }]], { account: organizer.account });
    assert.equal(await factory.read.eventContractsLength(), 1n);
    await expectRevert(() => factory.write.createEvent([organizer.account.address, marketplace.account.address, `0x${'44'.repeat(32)}`, 150, 500, 'https://example.com/tickets/', [{ tierId: 1n, tierReference: `0x${'55'.repeat(32)}`, faceValue: 1000n, configuredSupply: 1n }]], { account: organizer.account }));
    await factory.write.transferOwnership([organizer.account.address], { account: owner.account });
    await expectRevert(() => factory.write.renounceOwnership({ account: organizer.account }));
  });
});
