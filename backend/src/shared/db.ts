import {
  RDSDataClient,
  ExecuteStatementCommand,
  BeginTransactionCommand,
  CommitTransactionCommand,
  RollbackTransactionCommand,
  type SqlParameter,
  type Field,
} from "@aws-sdk/client-rds-data";

const client = new RDSDataClient({});

const resourceArn = process.env.DB_CLUSTER_ARN!;
const secretArn = process.env.DB_SECRET_ARN!;
const database = process.env.DB_NAME!;

export type SqlParams = Record<string, string | number | boolean | null>;

function toSqlParameters(params: SqlParams): SqlParameter[] {
  return Object.entries(params).map(([name, value]) => {
    if (value === null) return { name, value: { isNull: true } };
    if (typeof value === "string") return { name, value: { stringValue: value } };
    if (typeof value === "boolean") return { name, value: { booleanValue: value } };
    if (typeof value === "number") {
      return Number.isInteger(value)
        ? { name, value: { longValue: value } }
        : { name, value: { doubleValue: value } };
    }
    throw new Error(`Unsupported parameter type for "${name}"`);
  });
}

function fieldToJs(field: Field): unknown {
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  return null;
}

// Aurora Serverless v2 auto-pauses after 5 min idle (see template.yaml). The
// first Data API call after a pause fails fast with DatabaseResumingException
// instead of blocking until ready, so callers must retry while it wakes up -
// this is the normal, expected first-request-after-idle path, not a rare edge
// case. Resume typically finishes within 15-30s.
async function sendWithRetry<T>(send: () => Promise<T>): Promise<T> {
  // Kept comfortably under the 29s Lambda timeout (Globals.Function.Timeout
  // in template.yaml) even accounting for each attempt's own request time.
  const maxAttempts = 6;
  const delayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await send();
    } catch (err) {
      const isResuming = err instanceof Error && err.name === "DatabaseResumingException";
      if (!isResuming || attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("unreachable");
}

export async function query(
  sql: string,
  params: SqlParams = {},
  transactionId?: string
): Promise<Record<string, unknown>[]> {
  const result = await sendWithRetry(() =>
    client.send(
      new ExecuteStatementCommand({
        resourceArn,
        secretArn,
        database,
        sql,
        parameters: toSqlParameters(params),
        includeResultMetadata: true,
        transactionId,
      })
    )
  );

  const columns = result.columnMetadata ?? [];
  const records = result.records ?? [];

  return records.map((record) => {
    const row: Record<string, unknown> = {};
    record.forEach((field, i) => {
      const colName = columns[i]?.name ?? `col${i}`;
      row[colName] = fieldToJs(field);
    });
    return row;
  });
}

export async function execute(
  sql: string,
  params: SqlParams = {},
  transactionId?: string
): Promise<number> {
  const result = await sendWithRetry(() =>
    client.send(
      new ExecuteStatementCommand({
        resourceArn,
        secretArn,
        database,
        sql,
        parameters: toSqlParameters(params),
        transactionId,
      })
    )
  );
  return result.numberOfRecordsUpdated ?? 0;
}

// Explicit multi-statement transactions, needed wherever a read-then-write
// must be atomic across separate Data API calls (each ExecuteStatement is
// otherwise its own implicit transaction) - e.g. the FOR UPDATE row-lock
// pattern in redeemReward.ts. Always goes through runInTransaction below
// rather than being called directly, so commit/rollback can't be forgotten
// on an error path.
async function beginTransaction(): Promise<string> {
  const result = await sendWithRetry(() =>
    client.send(new BeginTransactionCommand({ resourceArn, secretArn, database }))
  );
  return result.transactionId!;
}

async function commitTransaction(transactionId: string): Promise<void> {
  await sendWithRetry(() => client.send(new CommitTransactionCommand({ resourceArn, secretArn, transactionId })));
}

async function rollbackTransaction(transactionId: string): Promise<void> {
  await sendWithRetry(() => client.send(new RollbackTransactionCommand({ resourceArn, secretArn, transactionId })));
}

export async function runInTransaction<T>(
  fn: (transactionId: string) => Promise<T>
): Promise<T> {
  const transactionId = await beginTransaction();
  try {
    const result = await fn(transactionId);
    await commitTransaction(transactionId);
    return result;
  } catch (err) {
    await rollbackTransaction(transactionId).catch(() => {
      // Best-effort - if rollback itself fails, the original error is what
      // matters and Data API will eventually expire the transaction anyway.
    });
    throw err;
  }
}
