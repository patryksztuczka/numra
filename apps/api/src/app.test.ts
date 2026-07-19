import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "./app.ts";
import {
  allowEmail,
  cookieHeaderFromResponse,
  revokeEmail,
  resetAuthState,
} from "./test/fixtures.ts";

const password = "correct-horse-battery-staple";

async function signUp(email: string, name = "Numra User") {
  return app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email,
        password,
        name,
      }),
    },
    env,
  );
}

async function signIn(email: string) {
  return app.request(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
    env,
  );
}

async function signOut(cookie: string) {
  return app.request(
    "/api/auth/sign-out",
    {
      method: "POST",
      headers: {
        origin: "http://localhost:5173",
        cookie,
      },
    },
    env,
  );
}

async function me(cookie?: string) {
  return app.request(
    "/me",
    cookie
      ? {
          headers: {
            cookie,
          },
        }
      : undefined,
    env,
  );
}

describe("api", () => {
  beforeEach(async () => {
    await resetAuthState();
  });

  it("reports its health", async () => {
    const response = await app.request("/health", undefined, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      timestamp: expect.any(String),
    });
  });

  it("requires authentication before revealing missing routes", async () => {
    const response = await app.request("/missing", undefined, env);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Authentication is required.",
    });
  });

  it("returns a structured 404 for authenticated missing routes", async () => {
    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    const response = await app.request(
      "/missing",
      {
        headers: {
          cookie,
        },
      },
      env,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "not_found",
      message: "The requested route does not exist.",
    });
  });

  it("rejects unauthenticated access to /me", async () => {
    const response = await me();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Authentication is required.",
    });
  });

  it("allows an allowlisted email to sign up, access /me, and sign out", async () => {
    await allowEmail("operator@numra.test");

    const signUpResponse = await signUp("operator@numra.test", "Operator");
    expect(signUpResponse.status).toBe(200);

    const cookie = cookieHeaderFromResponse(signUpResponse);
    expect(cookie.length).toBeGreaterThan(0);

    const meResponse = await me(cookie);
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      user: {
        email: "operator@numra.test",
        name: "Operator",
      },
    });

    const signOutResponse = await signOut(cookie);
    expect(signOutResponse.status).toBe(200);

    const meAfterSignOut = await me(cookie);
    expect(meAfterSignOut.status).toBe(401);
  });

  it("allows an allowlisted email to sign in after sign-up", async () => {
    await allowEmail("operator@numra.test");
    await signUp("operator@numra.test");

    const signInResponse = await signIn("operator@numra.test");
    expect(signInResponse.status).toBe(200);

    const cookie = cookieHeaderFromResponse(signInResponse);
    const meResponse = await me(cookie);

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      user: {
        email: "operator@numra.test",
      },
    });
  });

  it("rejects sign-up for emails that are not allowlisted", async () => {
    const response = await signUp("stranger@example.com");

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const body: unknown = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        message: expect.stringMatching(/not allowed/i),
      }),
    );
  });

  it("rejects sign-in for emails that are not allowlisted", async () => {
    await allowEmail("operator@numra.test");
    await signUp("operator@numra.test");
    await revokeEmail("operator@numra.test");

    const response = await signIn("operator@numra.test");

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const body: unknown = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        message: expect.stringMatching(/not allowed/i),
      }),
    );
  });

  it("matches allowlist entries after email case normalization", async () => {
    await allowEmail("operator@numra.test");

    const response = await signUp("Operator@Numra.Test", "Cased");
    expect(response.status).toBe(200);

    const cookie = cookieHeaderFromResponse(response);
    const meResponse = await me(cookie);

    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      user: {
        email: "operator@numra.test",
      },
    });
  });

  it("revokes access on /me when the email is removed from the allowlist", async () => {
    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    await revokeEmail("operator@numra.test");

    const meResponse = await me(cookie);
    expect(meResponse.status).toBe(403);
    await expect(meResponse.json()).resolves.toMatchObject({
      error: "forbidden",
    });
  });
});
