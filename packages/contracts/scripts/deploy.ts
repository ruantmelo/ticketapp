import hre from 'hardhat';

async function main() {
  const { viem } = hre;
  const [deployer] = await viem.getWalletClients();
  if (!deployer) {
    throw new Error('Missing deployer wallet');
  }
  const publicClient = await viem.getPublicClient();

  const marketplace = await viem.deployContract('MockMarketplace');
  const factory = await viem.deployContract('TicketFactory', [deployer.account.address, deployer.account.address]);
  const writableFactory = factory as any;

  const eventReference = `0x${'11'.repeat(32)}` as const;
  const tiers = [
    { tierId: 1n, tierReference: `0x${'22'.repeat(32)}` as const, faceValue: 50_000_000n, configuredSupply: 2n },
    { tierId: 2n, tierReference: `0x${'33'.repeat(32)}` as const, faceValue: 120_000_000n, configuredSupply: 1n },
  ];

  const createHash = await writableFactory.write.createEvent([
    deployer.account.address,
    marketplace.address,
    eventReference,
    120n,
    500n,
    `https://api.ticket-chain.local/events/${eventReference}/tickets/`,
    tiers,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: createHash });

  const ticketAddress = await writableFactory.read.ticketContractsByEventReference([eventReference]) as `0x${string}`;
  const ticket = await viem.getContractAt('TicketNFT', ticketAddress) as any;

  for (const tier of tiers) {
    const mintHash = await ticket.write.mintBatch([tier.tierId, tier.configuredSupply]);
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
  }

  const finalizeHash = await ticket.write.finalizeMinting();
  await publicClient.waitForTransactionReceipt({ hash: finalizeHash });

  console.log(`Factory: ${factory.address}`);
  console.log(`MockMarketplace: ${marketplace.address}`);
  console.log(`TicketNFT: ${ticketAddress}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
