// Prisma 7 does NOT auto-load .env — the `dotenv/config` import below is what
// makes DATABASE_URL visible to the CLI. Without it, `prisma migrate dev`
// reports an undefined datasource URL while the running app works fine.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Local file on purpose: Prisma Migrate needs a real SQLite connection and
    // cannot migrate a remote libsql:// database. See prisma/MIGRATIONS.md.
    url: process.env['DATABASE_URL'],
  },
});
