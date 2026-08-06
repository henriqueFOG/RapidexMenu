import { ensureDemoData, DEMO_RESTAURANT_ID } from "../lib/demo-data";
import { getPostgresDatabase } from "../lib/postgres-d1";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("Configure DATABASE_URL antes de carregar os dados de HMG.");
}

const database = getPostgresDatabase(connectionString);
await ensureDemoData(database);

const restaurant = await database
  .prepare("SELECT slug, name FROM restaurants WHERE id = ?")
  .bind(DEMO_RESTAURANT_ID)
  .first<{ slug: string; name: string }>();

if (!restaurant) throw new Error("Os dados de HMG nao foram criados.");

console.log(`HMG pronta: ${restaurant.name} (${restaurant.slug}).`);
