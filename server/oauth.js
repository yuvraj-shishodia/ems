import { createRemoteJWKSet, jwtVerify } from "jose";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export async function verifyGoogleToken(
  token,
  audience,
  nonce,
  keys = googleKeys,
) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
    algorithms: ["RS256"],
    maxTokenAge: "10m",
    requiredClaims: ["sub", "email", "email_verified", "nonce", "exp", "iat"],
  });
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.email !== "string"
  )
    throw new Error("Google identity could not be verified.");
  return {
    subject: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
  };
}
export function createProviders(
  env = process.env,
  { fetchImpl = fetch, verifyGoogle = verifyGoogleToken } = {},
) {
  async function json(url, options) {
    const response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error("The provider did not accept this sign-in.");
    const result = await response.json();
    if (result.error)
      throw new Error("The provider did not accept this sign-in.");
    return result;
  }
  const providers = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    providers.google = {
      name: "Google",
      clientId: env.GOOGLE_CLIENT_ID,
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      scope: "openid email profile",
      async exchange({ code, redirectUri, verifier, nonce }) {
        const token = await json("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code_verifier: verifier,
          }),
        });
        return verifyGoogle(token.id_token, env.GOOGLE_CLIENT_ID, nonce);
      },
    };
  return providers;
}
