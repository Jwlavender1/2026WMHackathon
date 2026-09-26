import { Client } from 'pg';
import { connectionOptions } from '../src/lib/db/connection';
async function main() {
  const name = process.env.DATABASE_APP_USER,
    url = process.env.MIGRATION_DATABASE_URL;
  if (!url || !name)
    throw new Error(
      'Set MIGRATION_DATABASE_URL and DATABASE_APP_USER (an existing restricted login).',
    );
  const client = new Client(connectionOptions(url));
  await client.connect();
  try {
    const { rows } = await client.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolcanlogin: boolean;
      owner: boolean;
    }>(
      'SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolcanlogin,rolname=current_user AS owner FROM pg_roles WHERE rolname=$1',
      [name],
    );
    const role = rows[0];
    if (
      !role ||
      !role.rolcanlogin ||
      role.owner ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.rolcreaterole ||
      role.rolcreatedb
    )
      throw new Error(
        'Use a separate restricted runtime login, not the schema owner or an admin role.',
      );
    const access = await client.query<{ writes: boolean }>(
      "SELECT has_table_privilege($1,'public.users','INSERT,UPDATE,DELETE') AS writes",
      [name],
    );
    if (access.rows[0].writes)
      throw new Error(
        'This login already has broad table-write privileges. Use a fresh restricted runtime login.',
      );
    const literal = `"${name.replaceAll('"', '""')}"`;
    await client.query(`GRANT commonly_runtime TO ${literal}`);
    console.log('Runtime permission membership granted. Use this login in DATABASE_URL.');
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Role setup failed.');
  process.exitCode = 1;
});
