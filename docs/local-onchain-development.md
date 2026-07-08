# Local on-chain development

Use this flow to test event creation and the Minting Engine with real smart contracts without using Polygon Amoy faucets.

The recommended local flow uses Anvil through Docker Compose with persistent state. The API signer acts as the temporary organizer custodial wallet and must be the same account used by the deployed `TicketFactory` as `platformOrchestrator`.

## 1. Install dependencies and compile contracts

From the repository root:

```bash
pnpm install
pnpm --filter @ticket-chain/contracts build
```

## 2. Start the persistent local chain

In terminal 1:

```bash
docker compose up -d anvil
docker compose logs -f anvil
```

Copy the private key from the first account printed by Anvil. This key is only for the local development network.

The Anvil state is persisted under:

```text
.local-chain/anvil/anvil-state.json
```

Stopping and starting the container keeps deployed contracts, balances, events, and transactions as long as this file is kept.

## 3. Deploy the factory and mock marketplace locally

In terminal 2:

```bash
cd packages/contracts
npx hardhat run scripts/deploy.ts --network localhost
```

Copy the printed addresses:

```text
Factory: 0x...
MockMarketplace: 0x...
```

## 4. Configure the API

Copy the API environment file if needed:

```bash
cp apps/api/.env.example apps/api/.env
```

Set these values in `apps/api/.env`:

```env
ONCHAIN_MINTING_ENABLED=true
CHAIN_RPC_URL=http://127.0.0.1:8545
CHAIN_PRIVATE_KEY=0xPRIVATE_KEY_FROM_ANVIL_ACCOUNT
CHAIN_ID=31337
TICKET_FACTORY_ADDRESS=0xFACTORY_FROM_DEPLOY_SCRIPT
TICKET_MARKETPLACE_ADDRESS=0xMARKETPLACE_FROM_DEPLOY_SCRIPT
TICKET_BASE_URI=http://localhost:4000/metadata/
AMOY_MAX_SYNC_SUPPLY=1000
```

The `CHAIN_PRIVATE_KEY` must belong to the same local account used by the deploy script. That account is both the temporary organizer custodial wallet and the factory `platformOrchestrator` for local testing.

## 5. Start the app

From the repository root:

```bash
pnpm db:push
pnpm db:seed
pnpm dev
```

Open:

```text
http://localhost:5173
```

Login with a seeded organizer, for example:

```text
organizador@ticketapp.com
organizador123
```

Create an event through the organizer panel. When you submit the final step, the API will:

1. Create a per-event `TicketNFT` through `TicketFactory`.
2. Mint the configured ticket tiers in batches.
3. Finalize minting.
4. Store the real local contract address on the event.

## Inspect local contracts

Open the Hardhat console against the Anvil RPC:

```bash
cd packages/contracts
npx hardhat console --network localhost
```

List event contracts from the factory:

```js
const factory = await viem.getContractAt("TicketFactory", "0xFACTORY_FROM_DEPLOY_SCRIPT")
const total = await factory.read.eventContractsLength()
for (let i = 0n; i < total; i++) console.log(i.toString(), await factory.read.eventContracts([i]))
```

Inspect a `TicketNFT`:

```js
const ticket = await viem.getContractAt("TicketNFT", "0xTICKET_NFT_ADDRESS")
await ticket.read.organizer()
await ticket.read.owner()
await ticket.read.marketplace()
await ticket.read.mintingFinalized()
```

## Stop, restart, or reset the local chain

Stop while keeping state:

```bash
docker compose stop anvil
```

Start again with the same state:

```bash
docker compose up -d anvil
```

Reset the local blockchain completely:

```bash
docker compose down
rm -rf .local-chain/anvil
```

If you reset the chain, redeploy the contracts and update `apps/api/.env` with the new `TICKET_FACTORY_ADDRESS` and `TICKET_MARKETPLACE_ADDRESS`. If the API database still contains events pointing to old local contract addresses, reset it too:

```bash
rm -rf apps/api/data
pnpm db:push
pnpm db:seed
```

## Current local limitations

- This local flow does not require faucets or real funds.
- Anvil state persists in `.local-chain/anvil/anvil-state.json`; deleting that directory resets the blockchain.
- The temporary organizer custodial wallet is the API signer. Per-organizer custodial wallets are still future work.
- All ticket tiers in an event must share the same price cap and royalty because the current contract enforces an event-level resale rule.
- `faceValue` is sent on-chain as a positive integer in payment token smallest unit.
- Existing partially minted and unfinalized contracts attempt `finalizeMinting()` once, then require manual recovery. Full retry semantics remain technical debt for the Minting Engine.
