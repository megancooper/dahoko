import { describe, expect, it } from "vitest";
import { normalizeSyncServerUrl } from "./api";

describe("normalizeSyncServerUrl", () => {
  it("requires HTTPS for remote servers", () => {
    expect(() =>
      normalizeSyncServerUrl("http://sync.example.com"),
    ).toThrow("requires HTTPS");
    expect(normalizeSyncServerUrl("https://sync.example.com/")).toBe(
      "https://sync.example.com",
    );
  });

  it("allows loopback HTTP for local self-hosting", () => {
    expect(normalizeSyncServerUrl("http://127.0.0.1:8787/")).toBe(
      "http://127.0.0.1:8787",
    );
    expect(normalizeSyncServerUrl("http://localhost:8787")).toBe(
      "http://localhost:8787",
    );
  });

  it("rejects embedded credentials and query parameters", () => {
    expect(() =>
      normalizeSyncServerUrl("https://user:pass@sync.example.com"),
    ).toThrow("cannot contain credentials");
    expect(() =>
      normalizeSyncServerUrl("https://sync.example.com?token=secret"),
    ).toThrow("cannot contain credentials");
  });
});
