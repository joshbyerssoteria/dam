// One-off: find the IPv4 pooler host for the Supabase project when the
// direct db.* host is unreachable (IPv6-only networks).
import { Client } from "pg";

const PROJECT_REF = "mdtectgfqdowzoepqvrk";
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!PASSWORD) {
  console.error("Set SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ca-central-1", "eu-west-1", "eu-west-2", "eu-central-1",
];
const HOSTS = REGIONS.map((region) => `aws-1-${region}.pooler.supabase.com`);

for (const host of HOSTS) {
  const client = new Client({
    host,
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
    password: PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  try {
    await client.connect();
    const { rows } = await client.query("select version()");
    console.log(`FOUND ${host} :: ${rows[0].version.slice(0, 40)}`);
    await client.end();
    process.exit(0);
  } catch (error) {
    console.log(`${host}: ${error.message.slice(0, 80)}`);
    try { await client.end(); } catch {}
  }
}
console.error("No pooler host matched.");
process.exit(1);
