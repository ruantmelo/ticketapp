export interface TicketTierOffer {
  id: string;
  name: string;
  faceValue: number;
  available: number;
  resaleCapPct: number;
}

export interface MarketplaceEvent {
  id: string;
  title: string;
  organizerName: string;
  location: string;
  startsAt: string;
  artworkUrl: string | null;
  tiers: TicketTierOffer[];
}

export interface ResaleListing {
  id: string;
  eventId: string;
  tierId: string;
  tierName: string;
  faceValue: number;
  price: number;
  sellerName: string;
  listedAt: string;
  isOwn?: boolean;
}

export interface OwnedTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventLocation: string;
  eventStartsAt: string;
  artworkUrl: string | null;
  tierName: string;
  faceValue: number;
  resaleCapPct: number;
  tokenId: string;
  status: "valid" | "listed" | "used";
  listingPrice: number | null;
}
