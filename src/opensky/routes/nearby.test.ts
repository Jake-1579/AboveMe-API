import Fastify, { type FastifyInstance } from "fastify";
import getToken from "../authentication.js";
import nearbyRoute from "./nearby.js";

jest.mock("../src/opensky/authentication");

const getTokenMock = jest.mocked(getToken);

const STATES_URL = "https://opensky-network.org/api/states/all";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const requestedBox = (fetchMock: jest.SpiedFunction<typeof fetch>) => {
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  return {
    origin: `${url.origin}${url.pathname}`,
    lamin: Number(url.searchParams.get("lamin")),
    lamax: Number(url.searchParams.get("lamax")),
    lomin: Number(url.searchParams.get("lomin")),
    lomax: Number(url.searchParams.get("lomax")),
  };
};

describe("GET /nearby", () => {
  let app: FastifyInstance;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(async () => {
    app = Fastify();
    app.register(nearbyRoute);
    await app.ready();

    getTokenMock.mockResolvedValue("test-token");
    fetchMock = jest.spyOn(globalThis, "fetch");
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it("returns the aircraft OpenSky reports", async () => {
    const openskyBody = {
      time: 1700000000,
      states: [["abc123", "BAW123 ", "United Kingdom"]],
    };
    fetchMock.mockResolvedValue(jsonResponse(openskyBody));

    const res = await app.inject({
      method: "GET",
      url: "/nearby?lat=53.35&lon=-2.25",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(openskyBody);
  });

  it("sends the token as a bearer token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ time: 0, states: null }));

    await app.inject({ method: "GET", url: "/nearby?lat=53.35&lon=-2.25" });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toEqual({
      headers: { Authorization: "Bearer test-token" },
    });
  });

  it("asks OpenSky for a 5 mile box by default", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ time: 0, states: null }));

    await app.inject({ method: "GET", url: "/nearby?lat=0&lon=0" });

    const box = requestedBox(fetchMock);
    expect(box.origin).toBe(STATES_URL);
    expect(box.lamin).toBeCloseTo(-5 / 69);
    expect(box.lamax).toBeCloseTo(5 / 69);
    expect(box.lomin).toBeCloseTo(-5 / 69);
    expect(box.lomax).toBeCloseTo(5 / 69);
  });

  it("uses the radius from the query string", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ time: 0, states: null }));

    await app.inject({ method: "GET", url: "/nearby?lat=0&lon=0&radius=20" });

    const box = requestedBox(fetchMock);
    expect(box.lamin).toBeCloseTo(-20 / 69);
    expect(box.lamax).toBeCloseTo(20 / 69);
  });

  it("widens the longitude range away from the equator", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ time: 0, states: null }));

    await app.inject({ method: "GET", url: "/nearby?lat=60&lon=10" });

    const box = requestedBox(fetchMock);
    expect(box.lamin).toBeCloseTo(60 - 5 / 69);
    expect(box.lamax).toBeCloseTo(60 + 5 / 69);
    expect(box.lomin).toBeCloseTo(10 - 10 / 69);
    expect(box.lomax).toBeCloseTo(10 + 10 / 69);
  });

  it.each([
    ["lat is missing", "/nearby?lon=-2.25"],
    ["lon is missing", "/nearby?lat=53.35"],
    ["lat is not a number", "/nearby?lat=abc&lon=-2.25"],
    ["lat is above 90", "/nearby?lat=91&lon=-2.25"],
    ["lon is below -180", "/nearby?lat=53.35&lon=-181"],
    ["radius is above 100", "/nearby?lat=53.35&lon=-2.25&radius=101"],
    ["radius is below 0.1", "/nearby?lat=53.35&lon=-2.25&radius=0"],
  ])("returns 400 when %s", async (_, url) => {
    const res = await app.inject({ method: "GET", url });

    expect(res.statusCode).toBe(400);
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 500 when OpenSky responds with an error status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 429));

    const res = await app.inject({
      method: "GET",
      url: "/nearby?lat=53.35&lon=-2.25",
    });

    expect(res.statusCode).toBe(500);
    expect(res.json().message).toContain("Unable to get nearby routes");
  });

  it("returns 500 without calling OpenSky when the token cannot be fetched", async () => {
    getTokenMock.mockRejectedValue(
      new Error("Missing CLIENT_ID or CLIENT_SECRET"),
    );

    const res = await app.inject({
      method: "GET",
      url: "/nearby?lat=53.35&lon=-2.25",
    });

    expect(res.statusCode).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
