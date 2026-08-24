import { neon, Pool } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getSql() {
  return neon(getDatabaseUrl());
}

export function getPool() {
  return new Pool({ connectionString: getDatabaseUrl() });
}
