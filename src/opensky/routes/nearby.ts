import type { FastifyInstance } from "fastify";
import getToken from "../authentication.js";

const MILES_PER_DEGREE_LAT = 69;

interface NearbyQuery {
  lat: number;
  lon: number;
  radius: number;
}

export default async function nearbyRoute(app: FastifyInstance) {
  app.get<{ Querystring: NearbyQuery }>(
    "/nearby",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["lat", "lon"],
          properties: {
            lat: { type: "number", minimum: -90, maximum: 90 },
            lon: { type: "number", minimum: -180, maximum: 180 },
            radius: { type: "number", minimum: 0.1, maximum: 100, default: 5 },
          },
        },
      },
    },
    async (request) => {
      const { lat, lon, radius } = request.query;

      const latDelta = radius / MILES_PER_DEGREE_LAT;
      const lonDelta =
        radius / (MILES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

      const params = new URLSearchParams({
        lamin: String(lat - latDelta),
        lamax: String(lat + latDelta),
        lomin: String(lon - lonDelta),
        lomax: String(lon + lonDelta),
      });

      try {
        const token = await getToken();
        const res = await fetch(
          `https://opensky-network.org/api/states/all?${params}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!res.ok) {
          throw new Error(`Response to states all unsuccessful ${res.status}`);
        }

        return await res.json();
      } catch (e) {
        throw new Error(`Unable to get nearby routes, Error::: ${e}`);
      }
    },
  );
}
