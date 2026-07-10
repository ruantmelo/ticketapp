import { describe, expect, it } from "vitest";
import { getAddress, recoverTypedDataAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  DYNAMIC_QR_ROTATION_SECONDS,
  buildDynamicQrTypedData,
  getDynamicQrWindowIndex,
  isDynamicQrWindowAccepted,
  parseDynamicQrPayload,
  serializeDynamicQrPayload,
} from "@ticket-chain/shared";

const contractAddress = "0x0000000000000000000000000000000000000123" as const;

describe("dynamic QR EIP-712 protocol", () => {
  it("round-trips a signed payload and recovers the ticket holder", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const typedData = buildDynamicQrTypedData({
      version: 1,
      chainId: 31337,
      contractAddress,
      tokenId: 42,
      windowIndex: getDynamicQrWindowIndex(),
    });

    const signature = await account.signTypedData(typedData);
    const serialized = serializeDynamicQrPayload({ ...typedData.message, signature });
    const parsed = parseDynamicQrPayload(serialized);

    expect(parsed).not.toBeNull();
    const recovered = await recoverTypedDataAddress({
      ...buildDynamicQrTypedData({ ...parsed!, contractAddress: parsed!.contractAddress as `0x${string}` }),
      signature: parsed!.signature as `0x${string}`,
    });
    expect(getAddress(recovered)).toBe(getAddress(account.address));
  });

  it("does not recover the holder when chainId is changed", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const typedData = buildDynamicQrTypedData({
      version: 1,
      chainId: 31337,
      contractAddress,
      tokenId: 42,
      windowIndex: getDynamicQrWindowIndex(),
    });
    const signature = await account.signTypedData(typedData);

    const recovered = await recoverTypedDataAddress({
      ...buildDynamicQrTypedData({ ...typedData.message, chainId: 80002, contractAddress }),
      signature,
    });

    expect(getAddress(recovered)).not.toBe(getAddress(account.address));
  });

  it("rejects expired windows", () => {
    const now = Date.now();
    const current = getDynamicQrWindowIndex(now);
    const expired = current - 2;

    expect(isDynamicQrWindowAccepted(current, now)).toBe(true);
    expect(isDynamicQrWindowAccepted(expired, now + DYNAMIC_QR_ROTATION_SECONDS * 1000)).toBe(false);
  });

  it("rejects malformed payloads", () => {
    expect(parseDynamicQrPayload("not-json")).toBeNull();
    expect(parseDynamicQrPayload(JSON.stringify({ version: 1 }))).toBeNull();
  });
});
