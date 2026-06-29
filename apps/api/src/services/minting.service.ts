import type { OnChainPreview, TicketTier } from "@ticket-chain/shared";

export interface MintingResult extends OnChainPreview {
  eventId: string;
}

export async function deployAndMint(
  event: {
    id: string;
    title: string;
    organizerId: string;
    tiers: TicketTier[];
  },
): Promise<MintingResult> {
  const totalSupply = event.tiers.reduce((sum, t) => sum + t.quantity, 0);
  const sumResale = event.tiers.reduce((sum, t) => sum + t.resaleCapPct * t.quantity, 0);
  const sumRoyalty = event.tiers.reduce((sum, t) => sum + t.royaltyPct * t.quantity, 0);
  const avgResaleCapPct = totalSupply > 0 ? Math.round(sumResale / totalSupply) : 0;
  const avgRoyaltyPct = totalSupply > 0 ? Math.round(sumRoyalty / totalSupply) : 0;

  const contractAddress = mockAddress(event.id);

  return {
    eventId: event.id,
    tokenStandard: "ERC-721",
    contractAddress,
    totalSupply,
    avgResaleCapPct,
    avgRoyaltyPct,
    royaltyReceiver: event.organizerId,
  };
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
