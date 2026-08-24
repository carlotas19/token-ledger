import { applySchema } from "../src/lib/schema";

async function migrate() {
  await applySchema();
  console.log("Database schema applied.");
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
