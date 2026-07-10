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
  const [owner, organizer, validator, buyer, other] = await viem.getWalletClients();
  const paymentToken = await viem.deployContract('MockUSDC');
  const marketplace = await viem.deployContract('TicketMarketplace', [paymentToken.address]);
  const nft = await viem.deployContract('TicketNFT', [
    organizer.account.address,
    marketplace.address,
    `0x${'11'.repeat(32)}`,
    120,
    500,
    'https://example.com/tickets/',
    [{ tierId: 1n, tierReference: `0x${'22'.repeat(32)}`, faceValue: 1000n, configuredSupply: 2n }],
  ]);

  await nft.write.mintBatch([1n, 2n], { account: organizer.account });
  await nft.write.finalizeMinting({ account: organizer.account });
  await nft.write.addValidator([validator.account.address], { account: organizer.account });
  await nft.write.transferFrom([organizer.account.address, buyer.account.address, 1n], { account: organizer.account });
  await nft.write.transferFrom([organizer.account.address, other.account.address, 2n], { account: organizer.account });

  await paymentToken.write.mint([buyer.account.address, 10_000n]);
  await paymentToken.write.mint([other.account.address, 10_000n]);

  return { owner, organizer, validator, buyer, other, nft, marketplace, paymentToken };
}

describe('TicketMarketplace', () => {
  it('rejects listing above the resale price cap', async () => {
    const { nft, marketplace, buyer } = await deployFixture();
    // faceValue 1000, cap multiplier 120 => max resale price 1200
    await nft.write.approve([marketplace.address, 1n], { account: buyer.account });
    await expectRevert(() => marketplace.write.list([nft.address, 1n, 1201n], { account: buyer.account }));
  });

  it('lists, sells, routes royalty, and transfers escrow atomically', async () => {
    const { nft, marketplace, paymentToken, buyer, other, organizer } = await deployFixture();

    await nft.write.approve([marketplace.address, 1n], { account: buyer.account });
    await marketplace.write.list([nft.address, 1n, 1200n], { account: buyer.account });

    assert.equal(await marketplace.read.isListed([nft.address, 1n]), true);
    assert.equal((await nft.read.ownerOf([1n])).toLowerCase(), marketplace.address.toLowerCase());

    await paymentToken.write.approve([marketplace.address, 1200n], { account: other.account });
    await marketplace.write.buy([1n], { account: other.account });

    assert.equal((await nft.read.ownerOf([1n])).toLowerCase(), other.account.address.toLowerCase());
    assert.equal(await marketplace.read.isListed([nft.address, 1n]), false);

    // royaltyPercentage = 500 bps (5%) of 1200 = 60; seller nets 1140
    assert.equal(await paymentToken.read.balanceOf([organizer.account.address]), 60n);
    assert.equal(await paymentToken.read.balanceOf([buyer.account.address]), 10_000n + 1140n);
    assert.equal(await paymentToken.read.balanceOf([other.account.address]), 10_000n - 1200n);
  });

  it('lets the seller cancel and reclaim escrow, and blocks buying an inactive listing', async () => {
    const { nft, marketplace, paymentToken, buyer, other } = await deployFixture();

    await nft.write.approve([marketplace.address, 1n], { account: buyer.account });
    await marketplace.write.list([nft.address, 1n, 1100n], { account: buyer.account });
    await expectRevert(() => marketplace.write.cancelListing([1n], { account: other.account }));

    await marketplace.write.cancelListing([1n], { account: buyer.account });
    assert.equal((await nft.read.ownerOf([1n])).toLowerCase(), buyer.account.address.toLowerCase());
    assert.equal(await marketplace.read.isListed([nft.address, 1n]), false);

    await paymentToken.write.approve([marketplace.address, 1100n], { account: other.account });
    await expectRevert(() => marketplace.write.buy([1n], { account: other.account }));
  });

  it('prevents double-listing the same token', async () => {
    const { nft, marketplace, buyer } = await deployFixture();
    await nft.write.approve([marketplace.address, 1n], { account: buyer.account });
    await marketplace.write.list([nft.address, 1n, 1000n], { account: buyer.account });
    await expectRevert(() => marketplace.write.list([nft.address, 1n, 1000n], { account: buyer.account }));
  });
});
