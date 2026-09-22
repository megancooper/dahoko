import { describe, expect, it } from "vitest";
import {
  GENERATED_PASSPHRASE_LENGTH,
  generateEncryptionPassphrase,
} from "./passphrase";

describe("generateEncryptionPassphrase", () => {
  it("produces five dash-separated groups from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const passphrase = generateEncryptionPassphrase();
      expect(passphrase).toHaveLength(GENERATED_PASSPHRASE_LENGTH);
      expect(passphrase).toMatch(
        /^[abcdefghjkmnpqrstwxyz2-9]{5}(-[abcdefghjkmnpqrstwxyz2-9]{5}){4}$/,
      );
    }
  });

  it("satisfies the connect validation length rule", () => {
    expect(GENERATED_PASSPHRASE_LENGTH).toBeGreaterThanOrEqual(16);
    expect(GENERATED_PASSPHRASE_LENGTH).toBeLessThanOrEqual(1_024);
  });

  it("never repeats across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2_000; i += 1) seen.add(generateEncryptionPassphrase());
    expect(seen.size).toBe(2_000);
  });

  it("uses every symbol of the alphabet over enough draws", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 500; i += 1) {
      for (const char of generateEncryptionPassphrase().replace(/-/g, "")) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe("abcdefghjkmnpqrstwxyz23456789".length);
  });
});
