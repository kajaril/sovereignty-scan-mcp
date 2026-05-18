import { describe, expect, it } from "vitest";
import app from "@/index";
import { makeTestEnv } from "./helpers";

const ctx = {} as ExecutionContext;

describe("POST /register", () => {
  it("registers a new email and returns an api_key", async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request("https://test.example/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "newuser@example.com" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { api_key?: string; plan?: string; message?: string };
    expect(typeof body.api_key).toBe("string");
    expect(body.api_key).toMatch(/^ks_free_/);
    expect(body.plan).toBe("free");
    expect(typeof body.message).toBe("string");
  });

  it("normalises email to lowercase", async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request("https://test.example/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "User@Example.COM" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    // Second call with lowercase should be rejected as duplicate
    const res2 = await app.fetch(
      new Request("https://test.example/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      }),
      env,
      ctx,
    );
    expect(res2.status).toBe(409);
  });

  it("rejects duplicate email with 409 and INPUT_INVALID", async () => {
    const env = makeTestEnv();
    const register = () =>
      app.fetch(
        new Request("https://test.example/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "dup@example.com" }),
        }),
        env,
        ctx,
      );
    await register();
    const res = await register();
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("INPUT_INVALID");
  });

  it("rejects invalid email format with 400 and INPUT_INVALID", async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request("https://test.example/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("INPUT_INVALID");
  });

  it("rejects missing email field with 400 and INPUT_INVALID", async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request("https://test.example/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("INPUT_INVALID");
  });

  it("rejects malformed JSON with 400 and INPUT_INVALID", async () => {
    const env = makeTestEnv();
    const res = await app.fetch(
      new Request("https://test.example/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{{not-json",
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("INPUT_INVALID");
  });
});
