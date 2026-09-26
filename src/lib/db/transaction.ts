export interface TransactionClient {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release(error?: Error | boolean): void;
}
// Every operation uses one connection and a transaction-local identity, never a pooled session setting.
export async function transaction<T, C extends TransactionClient>(
  client: C,
  resolveActor: (client: C) => Promise<string | null>,
  operation: (client: C, actor: string | null) => Promise<T>,
): Promise<T> {
  let broken = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', '', true)");
    const actor = await resolveActor(client);
    await client.query("SELECT set_config('app.user_id', $1, true)", [actor ?? '']);
    const result = await operation(client, actor);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken);
  }
}
