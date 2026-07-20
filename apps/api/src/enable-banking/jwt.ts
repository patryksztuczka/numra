import { importPKCS8, SignJWT } from "jose";

/** Build an RS256 application JWT for Enable Banking API calls. */
export async function createEnableBankingJwt(input: {
  applicationId: string;
  privateKeyPem: string;
  ttlSeconds?: number;
}): Promise<string> {
  const ttl = input.ttlSeconds ?? 3600;
  const now = Math.floor(Date.now() / 1000);
  const pem = normalizePrivateKeyPem(input.privateKeyPem);
  const key = await importPKCS8(pem, "RS256");

  return new SignJWT({
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
  })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
      kid: input.applicationId,
    })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);
}

function normalizePrivateKeyPem(value: string): string {
  // Secrets may store PEMs with literal \n sequences.
  const unescaped = value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
  return unescaped.trim();
}
