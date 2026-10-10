import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// One .env at the repo root serves the API and the Prisma CLI.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
