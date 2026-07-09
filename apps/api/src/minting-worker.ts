import { startMintingWorker } from "./services/minting.queue.js";

async function start(): Promise<void> {
  const close = await startMintingWorker(console);
  const shutdown = async () => {
    await close();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void start().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
