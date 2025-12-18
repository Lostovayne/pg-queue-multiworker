import type { Task } from "graphile-worker";
import { z } from "zod";

const WelcomeEmailSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
});

const task: Task = async (payload, helpers) => {
  const data = WelcomeEmailSchema.parse(payload);
  console.log(`[WORKER] Procesando email para ${data.email}`);

  // Simular la espera del envío del email
  await Bun.sleep(1000);

  console.log(`[WORKER] Email de bienvenida enviado a ${data.email}`);
};

export default task;
