import { run } from "graphile-worker";
import welcomeEmail from "./tasks/welcomeEmail";

const main = async () => {
  console.log("Iniciando el worker con Bun...");

  // Para Neon, sin listen
  const runner = await run({
    connectionString:
      process.env.DATABASE_URL || "postgres://user:password@localhost:5432/mydb",
    concurrency: 5,
    pollInterval: 2000,
    noHandleSignals: false,
    taskList: {
      welcome_email: welcomeEmail,
    },
  });

  await runner.promise;
};

main().catch((err) => {
  console.error("Error en el worker:", err);
  process.exit(1);
});
