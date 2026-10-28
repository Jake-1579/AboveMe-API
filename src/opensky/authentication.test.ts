import type getTokenFn from "./authentication.js";

const AUTHENTICATION_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("getToken", () => {
  let getToken: typeof getTokenFn;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    getToken = (await import("./authentication.js")).default;

    process.env = {
      ...originalEnv,
      CLIENT_ID: "test-client",
      CLIENT_SECRET: "test-secret",
    };
    fetchMock = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("requests a token using client credentials", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ access_token: "abc123", expires_in: 1800 }),
    );

    const token = await getToken();

    expect(token).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(AUTHENTICATION_URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });

    const body = init?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("test-client");
    expect(body.get("client_secret")).toBe("test-secret");
  });

  it("reuses the cached token while it is still valid", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ access_token: "abc123", expires_in: 1800 }),
    );

    expect(await getToken()).toBe("abc123");
    expect(await getToken()).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the token until 30 seconds before it expires", async () => {
    const start = 1_000_000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(start);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "first", expires_in: 1800 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "second", expires_in: 1800 }),
      );

    expect(await getToken()).toBe("first");

    nowSpy.mockReturnValue(start + 1769 * 1000);
    expect(await getToken()).toBe("first");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(start + 1770 * 1000);
    expect(await getToken()).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["CLIENT_ID", { CLIENT_ID: undefined }],
    ["CLIENT_SECRET", { CLIENT_SECRET: undefined }],
  ])(
    "throws without calling OpenSky when %s is missing",
    async (_, override) => {
      process.env = { ...process.env, ...override };

      await expect(getToken()).rejects.toThrow(
        "Missing CLIENT_ID or CLIENT_SECRET",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("throws when OpenSky responds with an error status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid_client" }, 401));

    await expect(getToken()).rejects.toThrow("OPENSKY failed to get token");
  });

  it("throws when the response has no access token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ expires_in: 1800 }));

    await expect(getToken()).rejects.toThrow(
      "failed to get token after successful response",
    );
  });

  it("throws when the request fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(getToken()).rejects.toThrow("fetch failed");
  });

  it("does not cache a failed request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "abc123", expires_in: 1800 }),
      );

    await expect(getToken()).rejects.toThrow();
    expect(await getToken()).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
