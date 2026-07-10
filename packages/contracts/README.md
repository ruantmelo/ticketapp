# Contracts

Hardhat workspace for F-ORG-02.

## Commands

- `pnpm --filter @ticket-chain/contracts test`
- `pnpm --filter @ticket-chain/contracts build`

## Networks

- `hardhat` local
- `localhost` for Anvil/Hardhat RPC on `http://127.0.0.1:8545`
- `polygonAmoy`

Polygon PoS mainnet deployment is intentionally not enabled for F-ORG-02 M1. When production deployment becomes in scope, add a gated mainnet network using chain ID `137`, a production RPC URL, and production key-management controls.

## Local deployment

Start the persistent local Anvil chain from the repository root:

```bash
docker compose up -d anvil
```

Then deploy the factory and mock marketplace:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

Copy the printed `Factory`, `TicketMarketplace`, and `PaymentToken (MockUSDC)` addresses into `apps/api/.env`. See [`../../docs/local-onchain-development.md`](../../docs/local-onchain-development.md) for the full API + web flow.
