import { DatabaseSync } from 'node:sqlite';

// Exercise the actual SQL without touching the installed board's database.
export function sqliteD1(sqlite = new DatabaseSync(':memory:')) {
  const prepare = (sql: string, values: unknown[] = []) => ({
    sql,
    values,
    bind: (...next: unknown[]) => prepare(sql, next),
    async first() {
      return sqlite.prepare(sql).get(...(values as never[])) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...(values as never[])) };
    },
    async run() {
      return {
        success: true,
        meta: sqlite.prepare(sql).run(...(values as never[])),
      };
    },
  });
  return {
    sqlite,
    db: {
      prepare,
      async batch(statements: ReturnType<typeof prepare>[]) {
        sqlite.exec('BEGIN');
        try {
          const results = [];
          for (const statement of statements)
            results.push(await statement.run());
          sqlite.exec('COMMIT');
          return results;
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    } as unknown as D1Database,
  };
}
