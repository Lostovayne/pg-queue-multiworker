/**
 * Script para pruebas de estrés en la nube (Railway)
 * Envía 1000 mensajes a la cola por segundo a la URL desplegada
 * Uso: bun cloud-stress-test.ts [url] [cantidad] [batch_size]
 * Ejemplo: bun cloud-stress-test.ts https://mi-app.railway.app 1000 1
 */

const API_URL = process.argv[2] || process.env.API_URL;
const TOTAL_JOBS = process.argv[3] ? parseInt(process.argv[3]) : 1000;
const BATCH_SIZE = process.argv[4] ? parseInt(process.argv[4]) : 1;

if (!API_URL) {
  console.error(
    "❌ Debes especificar la URL de la API desplegada (ej: https://mi-app.railway.app)"
  );
  process.exit(1);
}

const generateTestData = (index: number) => ({
  userId: crypto.randomUUID(),
  email: `cloud-user-${index}-${Date.now()}@example.com`,
});

const sendJob = async (index: number): Promise<{ success: boolean; time: number }> => {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generateTestData(index)),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const endTime = performance.now();
    return { success: true, time: endTime - startTime };
  } catch (error) {
    const endTime = performance.now();
    console.error(`❌ Error en job ${index}:`, error);
    return { success: false, time: endTime - startTime };
  }
};

const runTest = async (totalJobs: number, batchSize: number) => {
  console.log(`\n🚀 Enviando ${totalJobs} mensajes a ${API_URL} (batch: ${batchSize})`);
  const startTime = performance.now();
  const results: { success: boolean; time: number }[] = [];

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
  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

  console.log("\n\n═".repeat(60));
  console.log("📈 RESULTADOS DEL TEST");
  console.log("═".repeat(60));
  console.log(`✅ Jobs encolados exitosamente: ${successful}`);
  console.log(`❌ Jobs fallidos: ${failed}`);
  console.log(`⏱️  Tiempo total: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`⚡ Tiempo promedio por job: ${avgTime.toFixed(2)}ms`);
  console.log(`📊 Jobs por segundo: ${(totalJobs / (totalTime / 1000)).toFixed(2)}`);
  console.log("═".repeat(60));
};

runTest(TOTAL_JOBS, BATCH_SIZE).catch(console.error);
