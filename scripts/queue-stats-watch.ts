#!/usr/bin/env bun
/**
 * Script para mostrar estadísticas de la cola en tiempo real
 * Uso: bun queue-stats-watch.ts [url] [intervalo_ms]
 * Ejemplo: bun queue-stats-watch.ts http://localhost:3000 1000
 */

const API_URL = process.argv[2] || process.env.API_URL || "http://localhost:3000";
const INTERVAL = process.argv[3] ? parseInt(process.argv[3]) : 1000;

if (!API_URL) {
  console.error("❌ Debes especificar la URL de la API (ej: http://localhost:3000)");
  process.exit(1);
}

const fetchStats = async () => {
  try {
    const res = await fetch(`${API_URL}/queue/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return null;
  }
};

const printStats = (stats: any) => {
  if (!stats) {
    console.log("No se pudo obtener estadísticas de la cola.");
    return;
  }
  console.clear();
  console.log("═".repeat(50));
  console.log("📊 ESTADÍSTICAS DE LA COLA (Tiempo real)");
  console.log("═".repeat(50));
  // Resumen general
  const resumen = {
    pending: stats.pending,
    locked: stats.locked,
    failed: stats.failed,
    completed: stats.completed,
    total: stats.total,
  };
  console.table(resumen);

  // Desglose por Tarea
  if (stats.taskStats && stats.taskStats.length > 0) {
    console.log("\n📊 Desglose por Tarea:");
    console.table(stats.taskStats);
  }

  // Detalle por worker y sus jobs
  if (stats.activeJobs && stats.activeJobs.length > 0) {
    const jobsByWorker: Record<string, any[]> = {};
    
    // Agrupar jobs por worker
    stats.activeJobs.forEach((job: any) => {
      const workerId = job.locked_by || 'Desconocido';
      if (!jobsByWorker[workerId]) {
        jobsByWorker[workerId] = [];
      }
      jobsByWorker[workerId].push(job);
    });

    const workerIds = Object.keys(jobsByWorker);
    console.log("\n📊 ESTADO DE PROCESAMIENTO (Slots)");
    console.log(`   Total Slots Lógicos Activos: ${workerIds.length}`);
    console.log(`   Total Mensajes Procesándose: ${stats.locked}`);
    console.log(`   (Nota: ${workerIds.length} slots = Replicas x Concurrency)`);
    
    // Mostrar siempre el detalle para debug
    Object.entries(jobsByWorker).forEach(([workerId, jobs], index) => {
      console.log(`\n🔹 Slot ${index + 1} [ID: ${workerId}]`);
      console.log(`   Estado: TRABAJANDO (${jobs.length} mensaje(s))`);
      // Solo mostramos la tabla de jobs si son pocos, para no spammear
      if (jobs.length <= 5) {
        console.table(jobs, [
          "id",
          "task_identifier",
          "attempts",
          "run_at"
        ]);
      } else {
        console.log(`   (Procesando batch de mensajes...)`);
      }
    });

  } else {
    console.log("\n💤 No hay workers procesando mensajes ACTIVAMENTE.");
    if (stats.pending > 0) {
      console.log("⚠️  HAY MENSAJES PENDIENTES PERO NINGÚN WORKER LOS ESTÁ TOMANDO.");
      // ... same help message ...
    }
  }
  console.log("═".repeat(50));
  console.log(`Actualizando cada ${INTERVAL} ms...`);
};

(async () => {
  while (true) {
    const stats = await fetchStats();
    printStats(stats);
    await Bun.sleep(INTERVAL);
  }
})();
