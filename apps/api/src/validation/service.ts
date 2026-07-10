import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createPublicClient, createWalletClient, getAddress, http, recoverTypedDataAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildDynamicQrTypedData,
  isDynamicQrWindowAccepted,
  parseDynamicQrPayload,
  type ValidationScanResponse,
} from "@ticket-chain/shared";
import { db } from "../db/client.js";
import { custodialWallets, events, ticketTokens, ticketValidations } from "../db/schema.js";
import { env } from "../config.js";
import { TICKETING_CHAIN, loadArtifactAbi } from "../services/minting.service.js";

type ValidationDecision = ValidationScanResponse;

export async function validateAdmissionScan(input: { eventId: string; scannerUserId: string; payload: string }): Promise<ValidationDecision> {
  const parsed = parseDynamicQrPayload(input.payload);
  if (!parsed) return { status: "INVALID_QR", message: "QR inválido." };
  if (!isDynamicQrWindowAccepted(parsed.windowIndex)) return { status: "EXPIRED_QR", message: "QR expirado." };

  const eventRow = db.select().from(events).where(eq(events.id, input.eventId)).get();
  if (!eventRow || eventRow.status !== "minted" || !eventRow.contractAddress) {
    return { status: "FORBIDDEN_EVENT", message: "Evento indisponível para validação.", eventId: input.eventId };
  }

  if (parsed.chainId !== env.chainId) {
    return { status: "INVALID_QR", message: "QR não corresponde à rede configurada.", eventId: input.eventId };
  }

  let parsedContractAddress: Address;
  try {
    parsedContractAddress = getAddress(parsed.contractAddress as `0x${string}`);
  } catch {
    return { status: "INVALID_QR", message: "Contrato do QR inválido.", eventId: input.eventId };
  }

  if (getAddress(eventRow.contractAddress) !== parsedContractAddress) {
    return { status: "INVALID_QR", message: "QR não corresponde ao evento.", eventId: input.eventId };
  }

  const tokenRow = db
    .select()
    .from(ticketTokens)
    .where(and(eq(ticketTokens.eventId, input.eventId), eq(ticketTokens.tokenId, Number(parsed.tokenId))))
    .get();
  if (!tokenRow) return { status: "UNKNOWN_TICKET", message: "Ticket não encontrado.", eventId: input.eventId };
  if (tokenRow.status === "listed" || tokenRow.status === "pending_burn" || tokenRow.status === "burned") {
    return { status: "ALREADY_USED", message: "Ticket já utilizado.", ticketId: tokenRow.id, eventId: input.eventId };
  }

  const ownerCheck = await resolveOwnerAddress(tokenRow.ownerUserId, tokenRow.eventId, tokenRow.tokenId, tokenRow.id, eventRow.contractAddress);
  if (!ownerCheck.ok) return ownerCheck.response;

  const typedData = buildDynamicQrTypedData({ ...parsed, contractAddress: parsedContractAddress });
  let recovered: Address;
  try {
    recovered = await recoverTypedDataAddress({ ...typedData, signature: parsed.signature as `0x${string}` });
  } catch {
    return { status: "INVALID_SIGNATURE", message: "Assinatura inválida.", ticketId: tokenRow.id, eventId: input.eventId };
  }
  if (getAddress(recovered) !== getAddress(ownerCheck.address)) {
    return { status: "INVALID_SIGNATURE", message: "Assinatura inválida.", ticketId: tokenRow.id, eventId: input.eventId };
  }

  if (env.onchainMintingEnabled) {
    const relayerCheck = await resolveValidatorRelayerAuthorization(eventRow.contractAddress);
    if (!relayerCheck.ok) return relayerCheck.response;
  }

  const tokenId = Number(parsed.tokenId);
  const now = new Date();
  try {
    db.transaction((tx) => {
      tx.insert(ticketValidations).values({
        id: randomUUID(),
        eventId: input.eventId,
        ticketTokenId: tokenRow.id,
        contractAddress: eventRow.contractAddress!,
        tokenId,
        scannerUserId: input.scannerUserId,
        status: "pending_burn",
        createdAt: now,
      }).run();
      tx.update(ticketTokens).set({ status: "pending_burn" }).where(eq(ticketTokens.id, tokenRow.id)).run();
    });
  } catch {
    return { status: "ALREADY_USED", message: "Ticket já utilizado.", ticketId: tokenRow.id, eventId: input.eventId };
  }

  if (!env.onchainMintingEnabled) {
    db.update(ticketValidations).set({ status: "burned", confirmedAt: new Date() }).where(eq(ticketValidations.ticketTokenId, tokenRow.id)).run();
    db.update(ticketTokens).set({ status: "burned" }).where(eq(ticketTokens.id, tokenRow.id)).run();
    return { status: "VALID_ACCEPTED", message: "Entrada confirmada.", ticketId: tokenRow.id, eventId: input.eventId };
  }

  void burnTicketAsync({ contractAddress: eventRow.contractAddress!, tokenId, ticketTokenId: tokenRow.id, eventId: input.eventId });
  return { status: "VALID_ACCEPTED", message: "Entrada confirmada.", ticketId: tokenRow.id, eventId: input.eventId };
}

async function resolveValidatorRelayerAuthorization(contractAddress: string): Promise<{ ok: true } | { ok: false; response: ValidationDecision }> {
  try {
    const privateKey = validatorRelayerPrivateKey();
    const relayer = privateKeyToAccount(privateKey).address;
    const client = createPublicClient({ chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
    const nftAbi = loadArtifactAbi("TicketNFT");
    const authorized = await client.readContract({ address: getAddress(contractAddress), abi: nftAbi, functionName: "validators", args: [relayer] }) as boolean;
    if (!authorized) {
      return { ok: false, response: { status: "CHAIN_UNAVAILABLE", message: "Relayer de validação não autorizado para este evento." } };
    }
    return { ok: true };
  } catch {
    return { ok: false, response: { status: "CHAIN_UNAVAILABLE", message: "Não foi possível verificar o relayer de validação." } };
  }
}

function validatorRelayerPrivateKey(): `0x${string}` {
  const privateKey = env.validatorRelayerPrivateKey ?? (env.nodeEnv !== "production" ? env.chainPrivateKey : undefined);
  if (!privateKey) throw new Error("Missing validator relayer private key");
  return privateKey as `0x${string}`;
}

async function resolveOwnerAddress(ownerUserId: string | null, eventId: string, tokenId: number, ticketTokenId: string, contractAddress: string): Promise<{ ok: true; address: Address } | { ok: false; response: ValidationDecision }> {
  if (env.onchainMintingEnabled) {
    try {
      const client = createPublicClient({ chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
      const nftAbi = loadArtifactAbi("TicketNFT");
      const owner = await client.readContract({ address: getAddress(contractAddress), abi: nftAbi, functionName: "ownerOf", args: [BigInt(tokenId)] }) as Address;
      return { ok: true, address: owner };
    } catch {
      return { ok: false, response: { status: "CHAIN_UNAVAILABLE", message: "Blockchain indisponível.", ticketId: ticketTokenId, eventId } };
    }
  }

  if (!ownerUserId) {
    return { ok: false, response: { status: "NOT_OWNER", message: "Ticket sem proprietário válido.", ticketId: ticketTokenId, eventId } };
  }
  const wallet = db.select().from(custodialWallets).where(eq(custodialWallets.userId, ownerUserId)).get();
  if (!wallet) return { ok: false, response: { status: "NOT_OWNER", message: "Ticket sem carteira associada.", ticketId: ticketTokenId, eventId } };
  return { ok: true, address: getAddress(wallet.address) };
}

async function burnTicketAsync(input: { contractAddress: string; tokenId: number; ticketTokenId: string; eventId: string }): Promise<void> {
  try {
    const account = privateKeyToAccount(validatorRelayerPrivateKey());
    const publicClient = createPublicClient({ chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
    const walletClient = createWalletClient({ account, chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
    const nftAbi = loadArtifactAbi("TicketNFT");
    const { request } = await publicClient.simulateContract({ account, address: getAddress(input.contractAddress), abi: nftAbi, functionName: "burn", args: [BigInt(input.tokenId)] });
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("burn failed");
    db.update(ticketValidations).set({ status: "burned", txHash: hash, confirmedAt: new Date(), error: null }).where(eq(ticketValidations.ticketTokenId, input.ticketTokenId)).run();
    db.update(ticketTokens).set({ status: "burned" }).where(eq(ticketTokens.id, input.ticketTokenId)).run();
  } catch (error) {
    db.update(ticketValidations).set({ status: "burn_failed", error: error instanceof Error ? error.message : "burn failed" }).where(eq(ticketValidations.ticketTokenId, input.ticketTokenId)).run();
  }
}
