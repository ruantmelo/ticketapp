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

export async function deployAndMint(event: MintableEvent): Promise<MintingResult> {
  if (!env.onchainMintingEnabled) return mockMint(event);

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

  let createdNew = false;
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
        env.ticketBaseUri,
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
    createdNew = true;
  }

  await assertTicketPreflight(publicClient, ticketNftAbi, contractAddress, organizer, marketplaceAddress);

  const finalized = (await publicClient.readContract({
    address: contractAddress,
    abi: ticketNftAbi,
    functionName: "mintingFinalized",
  })) as boolean;

  if (finalized) {
    return buildResult(event.id, contractAddress, totalSupply, resaleCapPct, royaltyPct, organizer);
  }

  if (!createdNew) {
    await finalizeExistingContract(publicClient, walletClient, ticketNftAbi, contractAddress);
    return buildResult(event.id, contractAddress, totalSupply, resaleCapPct, royaltyPct, organizer);
  }

  for (const tier of tiers) {
    await mintTierChunks(publicClient, walletClient, ticketNftAbi, contractAddress, tier);
  }

  await finalizeMinting(publicClient, walletClient, ticketNftAbi, contractAddress);
  return buildResult(event.id, contractAddress, totalSupply, resaleCapPct, royaltyPct, organizer);
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
  organizer: Address,
  marketplaceAddress: Address,
): Promise<void> {
  const [ticketOrganizer, ticketOwner, ticketMarketplace] = await Promise.all([
    publicClient.readContract({ address: contractAddress, abi, functionName: "organizer" }),
    publicClient.readContract({ address: contractAddress, abi, functionName: "owner" }),
    publicClient.readContract({ address: contractAddress, abi, functionName: "marketplace" }),
  ]);

  if (
    getAddress(ticketOrganizer as Address) !== organizer ||
    getAddress(ticketOwner as Address) !== organizer ||
    getAddress(ticketMarketplace as Address) !== marketplaceAddress
  ) {
    throw new Error("Existing ticket contract failed preflight checks");
  }
}

async function mintTierChunks(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  abi: Abi,
  contractAddress: Address,
  tier: NormalizedTier,
): Promise<void> {
  for (let minted = 0; minted < tier.quantity; minted += 100) {
    const quantity = Math.min(100, tier.quantity - minted);
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
  }
}

async function finalizeExistingContract(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  abi: Abi,
  contractAddress: Address,
): Promise<void> {
  try {
    await finalizeMinting(publicClient, walletClient, abi, contractAddress);
  } catch (error) {
    throw new Error(
      `Existing unfinalized contract requires manual recovery and does not satisfy full F-ORG-02 retry semantics yet: ${(error as Error).message}`,
    );
  }
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
