import Fastify from "fastify";
import nearbyRoute from "./opensky/routes/nearby.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(nearbyRoute);

  return app;
}
