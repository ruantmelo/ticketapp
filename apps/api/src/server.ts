import { env } from "./config.js";
import { buildServer } from "./app.js";

async function start(): Promise<void> {
  const app = await buildServer();
  try {
    await app.listen({ host: env.host, port: env.port });
    app.log.info(`API listening on http://${env.host}:${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
