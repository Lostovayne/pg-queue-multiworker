import express from "express";
import { makeWorkerUtils } from "graphile-worker";

const app = express();
app.use(express.json());

// Inicializar graphile-worker (crea las tablas una sola vez al inicio)
let workerUtilsInstance: Awaited<ReturnType<typeof makeWorkerUtils>> | null = null;

const initializeWorkerUtils = async () => {
  if (!workerUtilsInstance) {
    console.log("🔧 Inicializando graphile-worker...");
    workerUtilsInstance = await makeWorkerUtils({
      connectionString: process.env.DATABASE_URL,
    });
    console.log("✅ Graphile-worker inicializado correctamente");
  }
  return workerUtilsInstance;
};

// Singleton pattern para workerUtils
const getWorkerUtils = async () => {
  return workerUtilsInstance || (await initializeWorkerUtils());
};

app.post("/register", async (req, res) => {
  try {
    const workerUtils = await getWorkerUtils();
    // Encolamos el trabajo
    await workerUtils.addJob("welcome_email", req.body, {
      maxAttempts: 5, // Resiliencia
    });

    res.json({ success: true, message: "Job encolado" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint para obtener estadísticas de la cola
app.get("/queue/stats", async (req, res) => {
  try {
    const workerUtils = await getWorkerUtils();

    const result = await workerUtils.withPgClient(async (client) => {
      // Estadísticas generales
      const stats = await client.query(`
        SELECT 
          COUNT(*) FILTER (WHERE locked_at IS NULL AND locked_by IS NULL) as pending,
          COUNT(*) FILTER (WHERE locked_at IS NOT NULL) as locked,
          COUNT(*) as total
        FROM graphile_worker.jobs;
      `);

      const failed = await client.query(`
        SELECT COUNT(*) as count 
        FROM graphile_worker.jobs 
        WHERE last_error IS NOT NULL;
      `);

      // Agrupación por worker
      const byWorker = await client.query(`
        SELECT locked_by, COUNT(*) as jobs
        FROM graphile_worker.jobs
        WHERE locked_at IS NOT NULL
        GROUP BY locked_by
        ORDER BY jobs DESC;
      `);

      // Jobs activos (siendo procesados actualmente)
      const activeJobs = await client.query(`
        SELECT id, task_identifier, run_at, locked_by, attempts, created_at
        FROM graphile_worker.jobs
        WHERE locked_at IS NOT NULL
        ORDER BY locked_by, created_at DESC;
      `);

      // Desglose por tipo de tarea (para ver si hay tareas sin procesar)
      const taskStats = await client.query(`
        SELECT 
          task_identifier,
          COUNT(*) FILTER (WHERE locked_at IS NULL) as pending,
          COUNT(*) FILTER (WHERE locked_at IS NOT NULL) as locked
        FROM graphile_worker.jobs
        GROUP BY task_identifier
        ORDER BY pending DESC;
      `);

      return {
        pending: parseInt(stats.rows[0].pending || "0"),
        locked: parseInt(stats.rows[0].locked || "0"),
        failed: parseInt(failed.rows[0].count || "0"),
        total: parseInt(stats.rows[0].total || "0"),
        completed:
          parseInt(stats.rows[0].total || "0") -
          parseInt(stats.rows[0].pending || "0") -
          parseInt(stats.rows[0].locked || "0"),
        workers: byWorker.rows,
        activeJobs: activeJobs.rows,
        taskStats: taskStats.rows,
      };
    });

    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint para liberar jobs trabados (útil en dev cuando reinicias workers)
app.post("/queue/reset-locks", async (req, res) => {
  try {
    const workerUtils = await getWorkerUtils();
    await workerUtils.withPgClient(async (client) => {
      // Liberar locks en las tablas privadas reales (graphile-worker v0.16+)
      
      // 1. Limpiar _private_job_queues
      await client.query(`
        UPDATE graphile_worker._private_job_queues 
        SET locked_at = NULL, locked_by = NULL 
        WHERE locked_at IS NOT NULL;
      `);

      // 2. Limpiar _private_jobs
      await client.query(`
        UPDATE graphile_worker._private_jobs 
        SET locked_at = NULL, locked_by = NULL 
        WHERE locked_at IS NOT NULL;
      `);
    });
    
    console.log("🔓 Se han liberado todos los jobs bloqueados (tablas privadas).");
    res.json({ success: true, message: "Todos los jobs han sido liberados de _private_jobs y _private_job_queues." });
  } catch (e: any) {
    console.error("Error reset-locks:", e);
    // Fallback: mostrar error detallado si falla
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;

// Inicializar antes de levantar el servidor
const startServer = async () => {
  await initializeWorkerUtils();

  app.listen(PORT, () => {
    console.log(`⚡️ API corriendo en puerto ${PORT} con Bun`);
  });
};

startServer().catch((err) => {
  console.error("Error al iniciar el servidor:", err);
  process.exit(1);
});
