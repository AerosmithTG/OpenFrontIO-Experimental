import { decodeJwt } from "jose";
import {
  TokenPayload,
  TokenPayloadSchema,
  UserMeResponse,
  UserMeResponseSchema,
} from "./ApiSchemas";

function getAudience() {
  const { hostname } = new URL(window.location.href);
  const domainname = hostname.split(".").slice(-2).join(".");
  return domainname;
}

function getApiBase() {
  const domainname = getAudience();
  return domainname === "localhost"
    ? "http://localhost:8787"
    : `https://api.${domainname}`;
}

function getToken(): string | null {
  const { hash } = window.location;
  if (hash.startsWith("#")) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");
    if (token) {
      localStorage.setItem("token", token);
    }
    // Clean the URL
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
  return localStorage.getItem("token");
}

export function discordLogin() {
  window.location.href = `${getApiBase()}/login/discord?redirect_uri=${window.location.href}`;
}

let __isLoggedIn: TokenPayload | false | undefined = undefined;
export function isLoggedIn(): TokenPayload | false {
  if (__isLoggedIn === undefined) {
    __isLoggedIn = _isLoggedIn();
  }
  return __isLoggedIn;
}
export function _isLoggedIn(): TokenPayload | false {
  try {
    const token = getToken();
    if (!token) {
      // console.log("No token found");
      return false;
    }

    // Verify the JWT (requires browser support)
    // const jwks = createRemoteJWKSet(
    //   new URL(getApiBase() + "/.well-known/jwks.json"),
    // );
    // const { payload, protectedHeader } = await jwtVerify(token, jwks, {
    //   issuer: getApiBase(),
    //   audience: getAudience(),
    // });

    // Decode the JWT
    const payload = decodeJwt(token);
    const { iss, aud, exp, iat } = payload;

    if (iss !== getApiBase()) {
      // JWT was not issued by the correct server
      console.error(
        'unexpected "iss" claim value',
        // JSON.stringify(payload, null, 2),
      );
      localStorage.removeItem("token");
      return false;
    }
    if (aud !== getAudience()) {
      // JWT was not issued for this website
      console.error(
        'unexpected "aud" claim value',
        // JSON.stringify(payload, null, 2),
      );
      localStorage.removeItem("token");
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    if (exp !== undefined && now >= exp) {
      // JWT expired
      console.error(
        'after "exp" claim value',
        // JSON.stringify(payload, null, 2),
      );
      localStorage.removeItem("token");
      return false;
    }
    // const maxAge: number | undefined = undefined;
    // if (iat !== undefined && maxAge !== undefined && now >= iat + maxAge) {
    //   // TODO: Refresh token...
    // }

    const result = TokenPayloadSchema.safeParse(payload);
    if (!result.success) {
      // Invalid response
      console.error(
        "Invalid payload",
        // JSON.stringify(payload),
        JSON.stringify(result.error),
      );
      return false;
    }

    return result.data;
  } catch (e) {
    console.log(e);
    return false;
  }
}

export async function getUserMe(): Promise<UserMeResponse | false> {
  try {
    const token = getToken();
    if (!token) return false;

    // Get the user object
    const response = await fetch(getApiBase() + "/users/@me", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    if (response.status !== 200) return false;
    const body = await response.json();
    const result = UserMeResponseSchema.safeParse(body);
    if (!result.success) {
      console.error(
        "Invalid response",
        JSON.stringify(body),
        JSON.stringify(result.error),
      );
      return false;
    }
    return result.data;
  } catch (e) {
    return false;
  }
}
