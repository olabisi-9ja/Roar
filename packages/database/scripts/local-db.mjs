// Local Postgres without Docker. Same credentials as docker-compose.yml, so DATABASE_URL works for both.
// Run: npm run db:local   (Ctrl+C to stop; data persists in packages/database/.pgdata)
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: "./.pgdata",
  user: "inside",
  password: "inside",
  port: 5432,
  persistent: true,
});

if (!existsSync("./.pgdata/PG_VERSION")) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("inside_the_game");
} catch {
  // already exists
}
console.log("Postgres ready on localhost:5432 (database inside_the_game)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
