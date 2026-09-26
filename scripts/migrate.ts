import { Client } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectionOptions } from '../src/lib/db/connection';
async function main() {
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('Set MIGRATION_DATABASE_URL to the schema owner connection.');
  const client = new Client(connectionOptions(process.env.MIGRATION_DATABASE_URL));
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('commonly:migrate'))");
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    await client.query('REVOKE ALL ON public.schema_migrations FROM PUBLIC');
    const directory = new URL('../database/migrations/', import.meta.url);
    for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      // Git may check out CRLF on Windows; identical migrations must hash consistently.
      const sql = (await readFile(new URL(file, directory), 'utf8')).replace(/\r\n/g, '\n'),
        checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM public.schema_migrations WHERE name=$1',
        [file],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(`Applied migration ${file} changed. Add a new migration instead.`);
        console.log(`Already applied: ${file}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
        console.log(`Applied: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Migration failed.');
  process.exitCode = 1;
});
