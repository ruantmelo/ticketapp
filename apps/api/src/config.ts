try {
  process.loadEnvFile();
} catch {
  // no .env file present — rely on real environment variables
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
} as const;
