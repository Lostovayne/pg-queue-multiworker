/**
 * Script de prueba para el sistema de colas
 * Uso: bun test-queue.ts [cantidad_de_jobs]
 * Ejemplo: bun test-queue.ts 50
 */

const API_URL = process.env.API_URL || "http://localhost:3000";
const DEFAULT_JOBS = 20;

// Generar email y userId aleatorios
const generateTestData = (index: number) => ({
  userId: crypto.randomUUID(),
  email: `test-user-${index}-${Date.now()}@example.com`,
});

// Función para enviar un job
const sendJob = async (index: number): Promise<{ success: boolean; time: number }> => {
  const startTime = performance.now();

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generateTestData(index)),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const endTime = performance.now();
    return { success: true, time: endTime - startTime };
  } catch (error) {
    const endTime = performance.now();
    console.error(`❌ Error en job ${index}:`, error);
    return { success: false, time: endTime - startTime };
  }
};

// Consultar estadísticas de la cola (requiere agregar endpoint en app.ts)
const getQueueStats = async () => {
  try {
    const response = await fetch(`${API_URL}/queue/stats`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    return null;
  }
};

// Función principal de prueba
const runTest = async (totalJobs: number, batchSize: number = 10) => {
  console.log("\n🚀 INICIANDO TEST DE COLAS");
  console.log("═".repeat(60));
  console.log(`📊 Total de jobs a encolar: ${totalJobs}`);
  console.log(`📦 Tamaño de batch: ${batchSize}`);
  console.log(`🎯 Endpoint: ${API_URL}/register`);
  console.log("═".repeat(60));

  const startTime = performance.now();
  const results: { success: boolean; time: number }[] = [];

  // Enviar jobs en batches
  for (let i = 0; i < totalJobs; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, totalJobs);
    const batchPromises = [];

    for (let j = i; j < batchEnd; j++) {
      batchPromises.push(sendJob(j + 1));
    }

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    const successful = results.filter((r) => r.success).length;
    const progress = ((results.length / totalJobs) * 100).toFixed(1);

    process.stdout.write(
      `\r⏳ Progreso: ${progress}% (${successful}/${results.length} exitosos)`
    );
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  // Estadísticas finales
  console.log("\n\n" + "═".repeat(60));
  console.log("📈 RESULTADOS DEL TEST");
  console.log("═".repeat(60));

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

  console.log(`✅ Jobs encolados exitosamente: ${successful}`);
  console.log(`❌ Jobs fallidos: ${failed}`);
  console.log(`⏱️  Tiempo total: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`⚡ Tiempo promedio por job: ${avgTime.toFixed(2)}ms`);
  console.log(`📊 Jobs por segundo: ${(totalJobs / (totalTime / 1000)).toFixed(2)}`);

  // Intentar obtener estadísticas de la cola
  const queueStats = await getQueueStats();
  if (queueStats) {
    console.log("\n📋 ESTADÍSTICAS DE LA COLA:");
    console.log(JSON.stringify(queueStats, null, 2));
  } else {
    console.log(
      "\n💡 Tip: Agrega el endpoint /queue/stats para ver estadísticas de la cola en tiempo real"
    );
  }

  console.log("═".repeat(60));
};

// Función de prueba de estrés con múltiples escenarios
const runStressTest = async () => {
  console.log("\n🔥 INICIANDO TEST DE ESTRÉS - MÚLTIPLES ESCENARIOS\n");

  const scenarios = [
    { name: "Carga baja", jobs: 10, batch: 5 },
    { name: "Carga media", jobs: 50, batch: 10 },
    { name: "Carga alta", jobs: 100, batch: 20 },
    { name: "Carga extrema", jobs: 200, batch: 50 },
  ];

  for (const scenario of scenarios) {
    console.log(`\n🎯 Escenario: ${scenario.name}`);
    await runTest(scenario.jobs, scenario.batch);
    console.log("\n⏸️  Esperando 3 segundos antes del siguiente escenario...");
    await Bun.sleep(3000);
  }

  console.log("\n\n✨ TEST DE ESTRÉS COMPLETADO\n");
};

// Main
const main = async () => {
  const args = process.argv.slice(2);

  if (args[0] === "stress") {
    await runStressTest();
  } else {
    const totalJobs = args[0] ? parseInt(args[0]) : DEFAULT_JOBS;
    const batchSize = args[1] ? parseInt(args[1]) : 10;

    if (isNaN(totalJobs) || totalJobs <= 0) {
      console.error("❌ Error: Cantidad de jobs debe ser un número positivo");
      console.log("\n📖 Uso:");
      console.log("  bun test-queue.ts [cantidad] [batch_size]");
      console.log("  bun test-queue.ts stress");
      console.log("\n📝 Ejemplos:");
      console.log("  bun test-queue.ts 50           # 50 jobs, batch de 10");
      console.log("  bun test-queue.ts 100 20       # 100 jobs, batch de 20");
      console.log("  bun test-queue.ts stress       # Test de estrés completo");
      process.exit(1);
    }

    await runTest(totalJobs, batchSize);
  }
};

main().catch(console.error);
