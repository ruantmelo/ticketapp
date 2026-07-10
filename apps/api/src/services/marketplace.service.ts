import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config.js";
import { TICKETING_CHAIN, loadArtifactAbi } from "./minting.service.js";
import { getCustodialWalletAccount } from "./custodial-wallet.service.js";

// Ticket prices (like `faceValue` in minting.service.ts) are passed on-chain
// as plain integers already denominated in the payment token's smallest unit
// — there is no separate reais-to-base-unit conversion here, matching the
// convention established by the minting engine.
function toBaseUnits(priceReais: number): bigint {
  return BigInt(priceReais);
}

function publicClient() {
  return createPublicClient({ chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
}

function organizerWalletClient() {
  const account = privateKeyToAccount(env.chainPrivateKey as `0x${string}`);
  return { account, client: createWalletClient({ account, chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) }) };
}

export async function transferPrimarySale(ticketContractAddress: string, tokenId: number, buyerUserId: string): Promise<void> {
  if (!env.onchainMintingEnabled) return;

  const nftAbi = loadArtifactAbi("TicketNFT");
  const { account, client: walletClient } = organizerWalletClient();
  const contractAddress = getAddress(ticketContractAddress);
  const buyerAccount = await getCustodialWalletAccount(buyerUserId);
  const client = publicClient();

  const { request } = await client.simulateContract({
    account,
    address: contractAddress,
    abi: nftAbi,
    functionName: "transferFrom",
    args: [account.address, buyerAccount.account.address, BigInt(tokenId)],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Primary sale transfer failed");
}

export async function listOnChain(ticketContractAddress: string, tokenId: number, priceReais: number, sellerUserId: string): Promise<number | null> {
  if (!env.onchainMintingEnabled) return null;

  const nftAbi = loadArtifactAbi("TicketNFT");
  const marketplaceAbi = loadArtifactAbi("TicketMarketplace");
  const { account, client: walletClient } = await getCustodialWalletAccount(sellerUserId);
  const contractAddress = getAddress(ticketContractAddress);
  const marketplaceAddress = getAddress(env.ticketMarketplaceAddress);
  const client = publicClient();

  const isApproved = await client.readContract({
    address: contractAddress,
    abi: nftAbi,
    functionName: "isApprovedForAll",
    args: [account.address, marketplaceAddress],
  });
  if (!isApproved) {
    const { request: approveRequest } = await client.simulateContract({
      account,
      address: contractAddress,
      abi: nftAbi,
      functionName: "setApprovalForAll",
      args: [marketplaceAddress, true],
    });
    const approveHash = await walletClient.writeContract(approveRequest);
    await client.waitForTransactionReceipt({ hash: approveHash });
  }

  const { request, result } = await client.simulateContract({
    account,
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "list",
    args: [contractAddress, BigInt(tokenId), toBaseUnits(priceReais)],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Listing transaction failed");
  return Number(result as bigint);
}

export async function buyListingOnChain(onChainListingId: number, priceReais: number, buyerUserId: string): Promise<void> {
  if (!env.onchainMintingEnabled) return;

  const marketplaceAbi = loadArtifactAbi("TicketMarketplace");
  const erc20Abi = loadArtifactAbi("MockUSDC");
  const { account, client: walletClient } = await getCustodialWalletAccount(buyerUserId);
  const marketplaceAddress = getAddress(env.ticketMarketplaceAddress);
  const paymentTokenAddress = getAddress(env.paymentTokenAddress);
  const client = publicClient();
  const priceBaseUnits = toBaseUnits(priceReais);

  await ensureBuyerCustodialFunded(paymentTokenAddress, account.address, priceBaseUnits, buyerUserId);

  const allowance = (await client.readContract({
    address: paymentTokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, marketplaceAddress],
  })) as bigint;
  if (allowance < priceBaseUnits) {
    const { request: approveRequest } = await client.simulateContract({
      account,
      address: paymentTokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [marketplaceAddress, priceBaseUnits],
    });
    const approveHash = await walletClient.writeContract(approveRequest);
    await client.waitForTransactionReceipt({ hash: approveHash });
  }

  const { request } = await client.simulateContract({
    account,
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "buy",
    args: [BigInt(onChainListingId)],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Purchase transaction failed");
}

export async function cancelListingOnChain(onChainListingId: number, sellerUserId: string): Promise<void> {
  if (!env.onchainMintingEnabled) return;

  const marketplaceAbi = loadArtifactAbi("TicketMarketplace");
  const { account, client: walletClient } = await getCustodialWalletAccount(sellerUserId);
  const marketplaceAddress = getAddress(env.ticketMarketplaceAddress);
  const client = publicClient();

  const { request } = await client.simulateContract({
    account,
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: "cancelListing",
    args: [BigInt(onChainListingId)],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Cancel listing transaction failed");
}

async function ensureBuyerCustodialFunded(paymentTokenAddress: Address, buyer: Address, minBalance: bigint, buyerUserId: string): Promise<void> {
  const client = publicClient();
  const erc20Abi = loadArtifactAbi("MockUSDC");
  const balance = (await client.readContract({
    address: paymentTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [buyer],
  })) as bigint;
  if (balance >= minBalance) return;

  const { account, client: walletClient } = await getCustodialWalletAccount(buyerUserId);
  const topUp = minBalance * 10n;
  const { request } = await client.simulateContract({
    account,
    address: paymentTokenAddress,
    abi: erc20Abi,
    functionName: "mint",
    args: [buyer, topUp],
  });
  const hash = await walletClient.writeContract(request);
  await client.waitForTransactionReceipt({ hash });
}
