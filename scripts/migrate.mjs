// Applies the SQL in ../migrations, in order, once each.
//
// Deliberately about eighty lines rather than a migration framework. The schema
// is four tables; a dependency that owns the database is a larger commitment
// than the problem justifies, and this way there is nothing to learn before
// reading what it does.
//
//   node scripts/migrate.mjs             apply anything outstanding
//   node scripts/migrate.mjs --dry-run   list it without applying
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "..", "migrations");
const dryRun = process.argv.includes("--dry-run");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Vercel injects it; locally it lives in .env.local, which Next reads for the
  // app but not for a plain script like this one.
  try {
    const env = readFileSync(join(HERE, "..", ".env.local"), "utf8");
    const line = env
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
  } catch {
    /* fall through to the error below */
  }
  throw new Error("DATABASE_URL is not set and .env.local has no DATABASE_URL.");
}

const files = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();

// The ledger of what has run. Created by the migrator rather than by a
// migration, because it has to exist before the first one can be recorded.
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const applied = new Map(
  (await client.query("SELECT filename, checksum FROM schema_migrations")).rows.map(
    (row) => [row.filename, row.checksum]
  )
);

let ran = 0;
for (const filename of files) {
  const sql = readFileSync(join(MIGRATIONS, filename), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);
  const previous = applied.get(filename);

  if (previous !== undefined) {
    // An applied migration that has since been edited means the database and
    // the repository disagree about history. Refuse rather than guess.
    if (previous !== checksum) {
      throw new Error(
        `${filename} has changed since it was applied ` +
          `(recorded ${previous}, now ${checksum}). ` +
          `Migrations are forward-only: add a new file instead of editing this one.`
      );
    }
    continue;
  }

  if (dryRun) {
    console.log(`would apply  ${filename}`);
    ran++;
    continue;
  }

  // One transaction per file, so a failure leaves nothing half-applied.
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
      [filename, checksum]
    );
    await client.query("COMMIT");
    console.log(`applied      ${filename}`);
    ran++;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`FAILED       ${filename}`);
    throw error;
  }
}

console.log(
  ran === 0
    ? `up to date (${files.length} migration${files.length === 1 ? "" : "s"})`
    : `${dryRun ? "would apply" : "applied"} ${ran} of ${files.length}`
);
await client.end();
