import Fastify from "fastify";
import getToken from "./opensky/authentication.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/test", async () => {
    const token = await getToken();

    const res = await fetch(
      "https://opensky-network.org/api/states/all?lamin=53.2&lamax=53.5&lomin=-2.5&lomax=-2.0",
      { headers: { Authorization: `Bearer ${token}` } },
    );

    return await res.json();
  });

  return app;
}
