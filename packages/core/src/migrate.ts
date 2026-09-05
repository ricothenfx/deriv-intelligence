import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getPool, query } from "./db";

export async function runMigrations(): Promise<string[]> {
  const pool = getPool();
  await query(
    `create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`,
  );
  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await query<{ name: string }>(`select name from schema_migrations`)).map((r) => r.name));
  const dim = String(Number(process.env.EMBEDDING_DIM || 1536));
  const done: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(dir, f), "utf8").replace(/%DIM%/g, dim);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [f]);
      await client.query("commit");
      done.push(f);
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  }
  return done;
}
