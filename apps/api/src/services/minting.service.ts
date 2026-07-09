import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { OnChainPreview, TicketTier } from "@ticket-chain/shared";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  keccak256,
  toBytes,
  zeroAddress,
  type Abi,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config.js";

export interface MintingResult extends OnChainPreview {
  eventId: string;
}

export type MintedTokenMetadata = {
  tokenId: number;
  tierId: string;
  onChainTierId: number;
};

type MintingHooks = {
  onContractResolved?: (result: MintingResult) => void | Promise<void>;
  onProgress?: (mintedCount: number, totalSupply: number) => void | Promise<void>;
};

type MintableEvent = {
  id: string;
  title: string;
  organizerId: string;
  tiers: TicketTier[];
};

type NormalizedTier = TicketTier & {
  id: string;
  onChainTierId: bigint;
};

const TICKETING_CHAIN: Chain = defineChain({
  id: env.chainId,
  name: env.chainId === 31337 ? "Hardhat Local" : "Polygon Amoy",
  nativeCurrency: env.chainId === 31337
    ? { name: "Ether", symbol: "ETH", decimals: 18 }
    : { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: { default: { http: [env.chainRpcUrl] } },
  blockExplorers: env.chainId === 31337
    ? undefined
    : { default: { name: "Polygonscan", url: "https://amoy.polygonscan.com" } },
});

export async function deployAndMint(event: MintableEvent, hooks: MintingHooks = {}): Promise<MintingResult> {
  if (!env.onchainMintingEnabled) {
    const result = mockMint(event);
    await hooks.onContractResolved?.(result);
    await hooks.onProgress?.(result.totalSupply, result.totalSupply);
    return result;
  }

  validateChainConfig();

  const factoryAbi = loadArtifactAbi("TicketFactory");
  const ticketNftAbi = loadArtifactAbi("TicketNFT");
  const account = privateKeyToAccount(env.chainPrivateKey as `0x${string}`);
  const organizer = account.address;
  const publicClient = createPublicClient({ chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
  const walletClient = createWalletClient({ account, chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
  const factoryAddress = getAddress(env.ticketFactoryAddress as Address);
  const marketplaceAddress = getAddress(env.ticketMarketplaceAddress as Address);
  const eventReference = keccak256(toBytes(event.id));
  const tiers = normalizeTiers(event.tiers);
  const totalSupply = tiers.reduce((sum, tier) => sum + tier.quantity, 0);

  if (totalSupply > env.amoyMaxSyncSupply) {
    throw new Error(`Total supply ${totalSupply} exceeds AMOY_MAX_SYNC_SUPPLY ${env.amoyMaxSyncSupply}`);
  }

  const resaleCapPct = tiers[0]?.resaleCapPct ?? 0;
  const royaltyPct = tiers[0]?.royaltyPct ?? 0;
  validateTierEconomics(tiers, resaleCapPct, royaltyPct);

  const royaltyBps = BigInt(royaltyPct * 100);
  const maxResalePriceMultiplier = BigInt(resaleCapPct);
  const baseTokenUri = buildEventBaseTokenUri(event.id);
  const mappedTiers = tiers.map((tier) => ({
    tierId: tier.onChainTierId,
    tierReference: keccak256(toBytes(tier.id)),
    faceValue: BigInt(tier.faceValue),
    configuredSupply: BigInt(tier.quantity),
  }));

  const orchestrator = await publicClient.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "platformOrchestrator",
  });

  if (getAddress(orchestrator as Address) !== organizer) {
    throw new Error(`Factory platformOrchestrator must equal signer address ${organizer}`);
  }

  let contractAddress = (await publicClient.readContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "ticketContractsByEventReference",
    args: [eventReference],
  })) as Address;

  if (contractAddress === zeroAddress) {
    const { request } = await publicClient.simulateContract({
      account,
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "createEvent",
      args: [
        organizer,
        marketplaceAddress,
        eventReference,
        maxResalePriceMultiplier,
        royaltyBps,
        baseTokenUri,
        mappedTiers,
      ],
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("createEvent transaction failed");

    contractAddress = (await publicClient.readContract({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "ticketContractsByEventReference",
      args: [eventReference],
    })) as Address;
  }

  await assertTicketPreflight(publicClient, ticketNftAbi, contractAddress, {
    organizer,
    marketplaceAddress,
    eventReference,
    maxResalePriceMultiplier,
    royaltyBps,
    baseTokenUri,
    tiers,
  });

  const resolvedContract = buildResult(event.id, contractAddress, totalSupply, resaleCapPct, royaltyPct, organizer);
  await hooks.onContractResolved?.(resolvedContract);

  const finalized = (await publicClient.readContract({
    address: contractAddress,
    abi: ticketNftAbi,
    functionName: "mintingFinalized",
  })) as boolean;

  if (finalized) {
    return resolvedContract;
  }

  let mintedCount = 0;
  for (const tier of tiers) {
    mintedCount += await mintTierChunks(publicClient, walletClient, ticketNftAbi, contractAddress, tier, async (tierMintedCount) => {
      await hooks.onProgress?.(mintedCount + tierMintedCount, totalSupply);
    });
    await hooks.onProgress?.(mintedCount, totalSupply);
  }

  await finalizeMinting(publicClient, walletClient, ticketNftAbi, contractAddress);
  return resolvedContract;
}

export function buildMockMintedTokens(tiers: TicketTier[]): MintedTokenMetadata[] {
  const tokens: MintedTokenMetadata[] = [];
  let tokenId = 1;
  for (const tier of normalizeTiers(tiers)) {
    for (let i = 0; i < tier.quantity; i++) {
      tokens.push({ tokenId, tierId: tier.id, onChainTierId: Number(tier.onChainTierId) });
      tokenId++;
    }
  }
  return tokens;
}

function mockMint(event: MintableEvent): MintingResult {
  const totalSupply = event.tiers.reduce((sum, t) => sum + t.quantity, 0);
  const sumResale = event.tiers.reduce((sum, t) => sum + t.resaleCapPct * t.quantity, 0);
  const sumRoyalty = event.tiers.reduce((sum, t) => sum + t.royaltyPct * t.quantity, 0);
  const avgResaleCapPct = totalSupply > 0 ? Math.round(sumResale / totalSupply) : 0;
  const avgRoyaltyPct = totalSupply > 0 ? Math.round(sumRoyalty / totalSupply) : 0;

  return {
    eventId: event.id,
    tokenStandard: "ERC-721",
    contractAddress: mockAddress(event.id),
    totalSupply,
    avgResaleCapPct,
    avgRoyaltyPct,
    royaltyReceiver: event.organizerId,
  };
}

function buildResult(
  eventId: string,
  contractAddress: Address,
  totalSupply: number,
  resaleCapPct: number,
  royaltyPct: number,
  organizer: Address,
): MintingResult {
  return {
    eventId,
    tokenStandard: "ERC-721",
    contractAddress,
    totalSupply,
    avgResaleCapPct: resaleCapPct,
    avgRoyaltyPct: royaltyPct,
    royaltyReceiver: organizer,
  };
}

async function assertTicketPreflight(
  publicClient: ReturnType<typeof createPublicClient>,
  abi: Abi,
  contractAddress: Address,
  expected: {
    organizer: Address;
    marketplaceAddress: Address;
    eventReference: `0x${string}`;
    maxResalePriceMultiplier: bigint;
    royaltyBps: bigint;
    baseTokenUri: string;
    tiers: NormalizedTier[];
  },
): Promise<void> {
  const [ticketOrganizer, ticketOwner, ticketMarketplace, ticketEventReference, ticketPriceCap, ticketRoyalty, ticketBaseUri, ticketTierIds] = await Promise.all([
    publicClient.readContract({ address: contractAddress, abi, functionName: "organizer" }),
    publicClient.readContract({ address: contractAddress, abi, functionName: "owner" }),
    publicClient.readContract({ address: contractAddress, abi, functionName: "marketplace" }),
    publicClient.readContract({ address: contractAddress, abi, functionName: "eventReference" }),
    publicClient.readContract({ address: contractAddress, abi, functionName: "maxResalePriceMultiplier" }),
    publicClient.readContract({ address: contractAddress, abi, functionName: "royaltyPercentage" }),
    readOptionalBaseTokenUri(publicClient, abi, contractAddress),
    publicClient.readContract({ address: contractAddress, abi, functionName: "tierIds" }),
  ]);

  if (
    getAddress(ticketOrganizer as Address) !== expected.organizer ||
    getAddress(ticketOwner as Address) !== expected.organizer ||
    getAddress(ticketMarketplace as Address) !== expected.marketplaceAddress ||
    ticketEventReference !== expected.eventReference ||
    ticketPriceCap !== expected.maxResalePriceMultiplier ||
    ticketRoyalty !== expected.royaltyBps ||
    (ticketBaseUri !== null && ticketBaseUri !== expected.baseTokenUri)
  ) {
    throw new Error("Existing ticket contract failed preflight checks");
  }

  const onChainTierIds = ticketTierIds as bigint[];
  if (onChainTierIds.length !== expected.tiers.length) throw new Error("Existing ticket contract tier count mismatch");

  for (const tier of expected.tiers) {
    if (!onChainTierIds.includes(tier.onChainTierId)) throw new Error(`Existing ticket contract missing tier ${tier.id}`);
    const [tierReference, configuredSupply, mintedSupply, faceValue] = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "tierInfo",
      args: [tier.onChainTierId],
    }) as [`0x${string}`, bigint, bigint, bigint];
    if (
      tierReference !== keccak256(toBytes(tier.id)) ||
      configuredSupply !== BigInt(tier.quantity) ||
      faceValue !== BigInt(tier.faceValue) ||
      mintedSupply > BigInt(tier.quantity)
    ) {
      throw new Error(`Existing ticket contract tier ${tier.id} failed preflight checks`);
    }
  }
}

async function readOptionalBaseTokenUri(
  publicClient: ReturnType<typeof createPublicClient>,
  abi: Abi,
  contractAddress: Address,
): Promise<string | null> {
  try {
    return await publicClient.readContract({ address: contractAddress, abi, functionName: "baseTokenURI" }) as string;
  } catch (error) {
    if (!isMissingBaseTokenUriGetterError(error)) throw error;
    return null;
  }
}

function isMissingBaseTokenUriGetterError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return message.includes('The contract function "baseTokenURI" reverted') ||
    message.includes('Function "baseTokenURI" not found') ||
    message.includes('function selector was not recognized');
}

async function mintTierChunks(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  abi: Abi,
  contractAddress: Address,
  tier: NormalizedTier,
  onTierProgress?: (mintedCount: number) => void | Promise<void>,
): Promise<number> {
  const mintedSupply = (await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "tierMintedSupply",
    args: [tier.onChainTierId],
  })) as bigint;
  const alreadyMinted = Number(mintedSupply);
  if (!Number.isSafeInteger(alreadyMinted) || alreadyMinted > tier.quantity) {
    throw new Error(`Tier ${tier.id} minted supply is inconsistent with configured supply`);
  }

  let mintedCount = alreadyMinted;
  if (mintedCount > 0) await onTierProgress?.(mintedCount);

  while (mintedCount < tier.quantity) {
    const quantity = Math.min(100, tier.quantity - mintedCount);
    const { request } = await publicClient.simulateContract({
      account: walletClient.account,
      address: contractAddress,
      abi,
      functionName: "mintBatch",
      args: [tier.onChainTierId, BigInt(quantity)],
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("mintBatch transaction failed");
    mintedCount += quantity;
    await onTierProgress?.(mintedCount);
  }

  return mintedCount;
}

async function finalizeMinting(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  abi: Abi,
  contractAddress: Address,
): Promise<void> {
  const { request } = await publicClient.simulateContract({
    account: walletClient.account,
    address: contractAddress,
    abi,
    functionName: "finalizeMinting",
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("finalizeMinting transaction failed");
}

function normalizeTiers(tiers: TicketTier[]): NormalizedTier[] {
  return [...tiers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((tier, index) => ({ ...tier, onChainTierId: BigInt(index + 1) }));
}

function validateTierEconomics(tiers: TicketTier[], resaleCapPct: number, royaltyPct: number): void {
  if (!tiers.length) throw new Error("At least one tier is required");
  if (!Number.isInteger(resaleCapPct) || resaleCapPct < 100 || resaleCapPct > 150) {
    throw new Error("Resale cap must be an integer between 100 and 150");
  }
  if (!Number.isInteger(royaltyPct) || royaltyPct < 0 || royaltyPct > 10) {
    throw new Error("Royalty must be an integer percentage between 0 and 10");
  }

  for (const tier of tiers) {
    if (!Number.isSafeInteger(tier.faceValue) || tier.faceValue <= 0) {
      throw new Error(`Tier ${tier.id} face value must be a positive safe integer in smallest payment-token units`);
    }
    if (!Number.isInteger(tier.quantity) || tier.quantity <= 0) {
      throw new Error(`Tier ${tier.id} quantity must be positive`);
    }
    if (tier.resaleCapPct !== resaleCapPct || tier.royaltyPct !== royaltyPct) {
      throw new Error("All tiers must share the same resale cap and royalty");
    }
  }
}

function validateChainConfig(): void {
  if (env.chainId !== 80002 && env.chainId !== 31337) {
    throw new Error(`CHAIN_ID must be 80002 for Amoy or 31337 for Hardhat local, got ${env.chainId}`);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(env.chainPrivateKey)) throw new Error("CHAIN_PRIVATE_KEY must be a 0x-prefixed private key");
  if (getAddress(env.ticketFactoryAddress as Address) === zeroAddress) throw new Error("TICKET_FACTORY_ADDRESS must be configured");
  if (getAddress(env.ticketMarketplaceAddress as Address) === zeroAddress) throw new Error("TICKET_MARKETPLACE_ADDRESS must be configured");
  if (!env.chainRpcUrl) throw new Error("CHAIN_RPC_URL must be configured");
  if (!env.ticketBaseUri) throw new Error("TICKET_BASE_URI must be configured");
  if (!Number.isSafeInteger(env.amoyMaxSyncSupply) || env.amoyMaxSyncSupply <= 0) {
    throw new Error("AMOY_MAX_SYNC_SUPPLY must be a positive safe integer");
  }
}

function buildEventBaseTokenUri(eventId: string): string {
  return `${env.ticketBaseUri.replace(/\/+$/, "")}/${eventId}/`;
}

function loadArtifactAbi(name: "TicketFactory" | "TicketNFT"): Abi {
  const artifactPath = resolveRepoRoot("packages/contracts/artifacts/contracts", `${name}.sol`, `${name}.json`);
  if (!existsSync(artifactPath)) {
    throw new Error(`Missing Hardhat artifact for ${name}. Run pnpm --filter @ticket-chain/contracts build first.`);
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi?: Abi };
  if (!artifact.abi) {
    throw new Error(`Invalid Hardhat artifact for ${name}. Run pnpm --filter @ticket-chain/contracts build first.`);
  }

  return artifact.abi;
}

function resolveRepoRoot(...segments: string[]): string {
  const apiDir = dirname(fileURLToPath(import.meta.url));
  return resolve(apiDir, "..", "..", "..", "..", ...segments);
}

function mockAddress(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, "0");
  return `0x${hex}1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b`.slice(0, 42);
}
