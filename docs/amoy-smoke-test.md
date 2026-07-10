# Polygon Amoy smoke test — F-ORG-02 Minting Engine

Use this runbook to validate the F-ORG-02 Minting Engine against Polygon Amoy without enabling Polygon PoS mainnet execution.

## Scope

This smoke test validates that the platform can:

1. deploy `TicketFactory`, the real `TicketMarketplace`, and a `MockUSDC` payment token to Polygon Amoy;
2. configure the API to use Amoy through viem;
3. publish a small organizer event through the frontend;
4. let the Minting Engine deploy a per-event `TicketNFT`, mint all ticket tiers, and finalize minting;
5. persist the contract address and indexed ticket tokens off-chain.

Do not use production keys or real customer data. The signer is a temporary development stand-in for the organizer custodial wallet until ADR 0007 is resolved.

## Prerequisites

- Dependencies installed with `pnpm install`.
- Contracts compiled with `pnpm --filter @ticket-chain/contracts build`.
- A Polygon Amoy RPC URL.
- A funded Amoy signer private key with test POL.
- Redis running locally: `docker compose up -d redis`.
- `AMOY_MAX_SYNC_SUPPLY` kept small for smoke runs, for example `25`.

## 1. Deploy F-ORG-02 contracts to Amoy

The current `scripts/deploy.ts` is a smoke deploy script: it deploys `MockUSDC`, `TicketMarketplace`, and `TicketFactory`, then creates, mints, and finalizes one sample `TicketNFT`. This side effect is intentional for contract-level smoke validation. The API/frontend smoke below must still publish a separate small event through the Minting Engine.

From `packages/contracts`:

```bash
POLYGON_AMOY_RPC_URL=https://YOUR_AMOY_RPC_URL \
PRIVATE_KEY=0xYOUR_FUNDED_AMOY_PRIVATE_KEY \
npx hardhat run scripts/deploy.ts --network polygonAmoy
```

Record the printed addresses:

```text
Factory: 0x...
TicketMarketplace: 0x...
PaymentToken (MockUSDC): 0x...
```

The deployer becomes the factory owner and initial `platformOrchestrator`. The API signer must be the same address for this smoke test unless the factory orchestrator is rotated deliberately.

## 2. Configure the API

Set these values in `apps/api/.env`:

```env
ONCHAIN_MINTING_ENABLED=true
CHAIN_RPC_URL=https://YOUR_AMOY_RPC_URL
CHAIN_PRIVATE_KEY=0xYOUR_FUNDED_AMOY_PRIVATE_KEY
CHAIN_ID=80002
TICKET_FACTORY_ADDRESS=0xFACTORY_FROM_DEPLOY_SCRIPT
TICKET_MARKETPLACE_ADDRESS=0xMOCK_MARKETPLACE_FROM_DEPLOY_SCRIPT
TICKET_BASE_URI=http://localhost:4000/metadata/
AMOY_MAX_SYNC_SUPPLY=25
REDIS_URL=redis://127.0.0.1:6379
MINTING_QUEUE_CONCURRENCY=1
```

## 3. Start the app and publish a small event

From the repository root:

```bash
pnpm db:push
pnpm db:seed
pnpm dev
```

Run `pnpm db:push` against the active API database after pulling schema changes. The Minting Engine persists `mint_total` and `mint_count`; an older local database without these columns must be migrated or reset before the smoke test.

Open `http://localhost:5173`, log in as an organizer, and publish a small event, for example one ticket tier with quantity `2` and a shared event-level resale rule.

## 4. Validate the result

Confirm all of the following before treating Amoy as validated:

- frontend event detail reaches `Mintado` / `Mint concluído`;
- API event response has `status = minted`, a non-empty `contractAddress`, and `mintProgress.mintedCount = mintProgress.totalSupply`;
- SQLite `events.status` is `minted` and `events.contract_address` is populated;
- SQLite `ticket_tokens` count for the event equals `events.total_supply`;
- Amoy explorer shows the factory `createEvent`, ticket `mintBatch`, and `finalizeMinting` transactions;
- `TicketNFT.mintingFinalized()` returns `true` when read against the persisted event contract address.

Optional Hardhat console check from `packages/contracts`:

```bash
POLYGON_AMOY_RPC_URL=https://YOUR_AMOY_RPC_URL \
PRIVATE_KEY=0xYOUR_FUNDED_AMOY_PRIVATE_KEY \
npx hardhat console --network polygonAmoy
```

```js
const ticket = await viem.getContractAt("TicketNFT", "0xTICKET_NFT_ADDRESS")
await ticket.read.mintingFinalized()
const tierIds = await ticket.read.tierIds()
for (const tierId of tierIds) console.log(tierId.toString(), (await ticket.read.tierMintedSupply([tierId])).toString())
```

## Failure and retry check

To validate retry behavior, intentionally interrupt the API worker or force a transient RPC failure during minting, then use the event detail page retry action after the event reaches `mint_failed`.

The retry is successful when the event returns to `minting`, then reaches `minted`, and the final token count still equals the configured supply without duplicate ticket token rows.

## Mainnet note

Polygon PoS mainnet deployment remains intentionally disabled for MVP execution. Mainnet enablement requires production RPC/provider controls, funded production key custody, explorer verification, and operational runbooks beyond this Amoy smoke test.
