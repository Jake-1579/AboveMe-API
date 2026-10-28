import { AuthenticationResponse } from "../types/authentication.types.js";

const AUTHENTICATION_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

let token: string | null = null;
let expiresAt = 0;

const getToken = async (): Promise<string> => {
  if (token && Date.now() < expiresAt) {
    return token;
  }

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing CLIENT_ID or CLIENT_SECRET");
  }

  try {
    const res = await fetch(AUTHENTICATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error("OPENSKY failed to get token");
    }

    const data: AuthenticationResponse = await res.json();
    token = data.access_token;

    const expireBuffer = 30;

    expiresAt = Date.now() + (data.expires_in - expireBuffer) * 1000;
    if (!token) {
      throw new Error("OPENSKY failed to get token after successful response");
    }

    return token;
  } catch (error) {
    throw new Error(`OPENSKY failed to get token ${error}`);
  }
};

export default getToken;
