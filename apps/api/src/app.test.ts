import { describe, expect, it } from "vitest";

import { app } from "./app.ts";

describe("api", () => {
  it("reports its health", async () => {
    const response = await app.request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      timestamp: expect.any(String),
    });
  });

  it("returns a structured 404", async () => {
    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "not_found",
      message: "The requested route does not exist.",
    });
  });
});
