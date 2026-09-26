import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { appMode, authConfiguration } from '../src/lib/config';
import { connectionOptions } from '../src/lib/db/connection';
import { transaction } from '../src/lib/db/transaction';
import { validateAvatar } from '../src/lib/avatar';

test('live mode fails closed; secrets and exact origins are required', () => {
  assert.equal(appMode({}), 'demo');
  assert.equal(appMode({ APP_MODE: 'live' }), 'live');
  assert.throws(() => appMode({ APP_MODE: 'typo' }), /APP_MODE/);
  assert.throws(() => authConfiguration({ APP_MODE: 'live' }), /AUTH0_CLIENT_SECRET/);
  const valid = {
    AUTH0_DOMAIN: 'test.us.auth0.com',
    AUTH0_CLIENT_ID: 'client',
    AUTH0_CLIENT_SECRET: 'secret',
    AUTH0_SECRET: 'ab'.repeat(32),
    APP_BASE_URL: 'http://localhost:3000',
  };
  assert.equal(authConfiguration(valid).appBaseUrl, 'http://localhost:3000');
  assert.throws(() => authConfiguration({ ...valid, APP_BASE_URL: 'http://example.com' }), /HTTPS/);
  assert.throws(() => authConfiguration({ ...valid, AUTH0_SECRET: 'short' }), /32-byte/);
});
test('remote PostgreSQL cannot disable certificate checks, including through URL parameters', () => {
  const config = connectionOptions(
    'postgres://user:pass@db.example.com:25060/common?sslmode=no-verify',
    { PGSSL_MODE: 'verify-full', PGSSL_CA: 'test-ca' },
  );
  assert.deepEqual(config.ssl, { rejectUnauthorized: true, ca: 'test-ca' });
  assert.ok(!config.connectionString!.includes('sslmode'));
  assert.throws(
    () => connectionOptions('postgres://u:p@db.example.com/common', { PGSSL_MODE: 'disable' }),
    /verified TLS/,
  );
  assert.equal(
    connectionOptions('postgres://u:p@localhost/common', { PGSSL_MODE: 'disable' }).ssl,
    false,
  );
});
test('transaction identity resets across pooled requests and rollback, using PostgreSQL settings', async () => {
  const db = new PGlite();
  let released = 0;
  const client = {
    query: (sql: string, values?: unknown[]) => db.query(sql, values),
    release: () => {
      released++;
    },
  };
  const id = '00000000-0000-4000-8000-000000000001';
  const read = async () =>
    (await db.query<{ id: string }>("select current_setting('app.user_id',true) as id")).rows[0]
      .id || null;
  try {
    await transaction(
      client,
      async () => id,
      async () => assert.equal(await read(), id),
    );
    assert.equal(await read(), null);
    await transaction(
      client,
      async () => null,
      async () => assert.equal(await read(), null),
    );
    await assert.rejects(
      transaction(
        client,
        async () => id,
        async () => {
          throw new Error('Test rollback');
        },
      ),
      /Test rollback/,
    );
    assert.equal(await read(), null);
    assert.equal(released, 3);
  } finally {
    await db.close();
  }
});
test('avatar validation rejects wrong file contents and oversized uploads', () => {
  assert.throws(() => validateAvatar('image/png', new Uint8Array(20)), /contents/);
  assert.throws(() => validateAvatar('image/png', new Uint8Array(2097153)), /under 2 MB/);
  validateAvatar('image/png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));
});
