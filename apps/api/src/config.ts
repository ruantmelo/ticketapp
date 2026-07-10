try {
  process.loadEnvFile();
} catch {
  // no .env file present — rely on real environment variables
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "true";
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.API_HOST ?? "127.0.0.1",
  port: Number(process.env.API_PORT ?? "4000"),
  databaseUrl: required("DATABASE_URL", "./data/ticket-chain.db"),
  uploadDir: required("UPLOAD_DIR", "./data/uploads"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me-in-production"),
  cookieDomain: process.env.COOKIE_DOMAIN ?? "localhost",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  onchainMintingEnabled: (process.env.ONCHAIN_MINTING_ENABLED ?? "false") === "true",
  chainRpcUrl: required("CHAIN_RPC_URL", "http://127.0.0.1:8545"),
  chainPrivateKey: required("CHAIN_PRIVATE_KEY", "0xYOUR_PRIVATE_KEY"),
  validatorRelayerPrivateKey: process.env.VALIDATOR_RELAYER_PRIVATE_KEY,
  chainId: Number(process.env.CHAIN_ID ?? "31337"),
  ticketFactoryAddress: required("TICKET_FACTORY_ADDRESS", "0x0000000000000000000000000000000000000000"),
  ticketMarketplaceAddress: required("TICKET_MARKETPLACE_ADDRESS", "0x0000000000000000000000000000000000000000"),
  paymentTokenAddress: required("PAYMENT_TOKEN_ADDRESS", "0x0000000000000000000000000000000000000000"),
  custodialWalletProvider: process.env.CUSTODIAL_WALLET_PROVIDER ?? "local-dev",
  allowLocalCustodialProvider: parseBoolean("ALLOW_LOCAL_CUSTODIAL_PROVIDER", process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"),
  allowPrivateKeyBootstrap: parseBoolean("ALLOW_PRIVATE_KEY_BOOTSTRAP", false),
  allowTestnetLocalCustody: parseBoolean("ALLOW_TESTNET_LOCAL_CUSTODY", false),
  localCustodyMasterKey: process.env.LOCAL_CUSTODY_MASTER_KEY,
  ticketBaseUri: required("TICKET_BASE_URI", "http://localhost:4000/metadata/"),
  amoyMaxSyncSupply: Number(process.env.AMOY_MAX_SYNC_SUPPLY ?? "1000"),
  redisUrl: required("REDIS_URL", "redis://127.0.0.1:6379"),
  mintingQueueConcurrency: Number(process.env.MINTING_QUEUE_CONCURRENCY ?? "1"),
  bullBoardEnabled: (process.env.BULL_BOARD_ENABLED ?? (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test" ? "false" : "true")) === "true",
  bullBoardBasePath: process.env.BULL_BOARD_BASE_PATH ?? "/admin/queues",
  bullBoardAllowRemote: (process.env.BULL_BOARD_ALLOW_REMOTE ?? "false") === "true",
} as const;

if (env.onchainMintingEnabled && env.nodeEnv === "production" && !env.validatorRelayerPrivateKey) {
  throw new Error("VALIDATOR_RELAYER_PRIVATE_KEY is required in production when on-chain validation is enabled");
}

if (env.nodeEnv === "production") {
  if (env.custodialWalletProvider === "local-dev") throw new Error("CUSTODIAL_WALLET_PROVIDER local-dev is not allowed in production");
  if (env.allowPrivateKeyBootstrap) throw new Error("ALLOW_PRIVATE_KEY_BOOTSTRAP is not allowed in production");
}

export const localCustodyMasterKey = env.localCustodyMasterKey ?? (env.nodeEnv !== "production" ? "dev-local-custody-master-key-change-me" : undefined);
