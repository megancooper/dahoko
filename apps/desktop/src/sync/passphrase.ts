/**
 * Encryption passphrases are generated on-device instead of typed by the
 * user: a chosen passphrase is one more secret to invent and forget before
 * sync even starts. The format is optimised for reading off one screen and
 * typing on another (a phone signing in to the same account):
 *
 * - lowercase letters and digits only, with the look-alikes 0/o, 1/l/i and
 *   u/v removed, so nothing is ambiguous in any font;
 * - five groups of five characters separated by dashes.
 *
 * 25 characters from a 30-symbol alphabet is ~122 bits of entropy, far past
 * the point where the PBKDF2 work factor matters. The result always satisfies
 * the 16–1,024 character rule in `validateConnectInput`.
 */
const ALPHABET = "abcdefghjkmnpqrstwxyz23456789";
const GROUPS = 5;
const GROUP_LENGTH = 5;

export const GENERATED_PASSPHRASE_LENGTH = GROUPS * GROUP_LENGTH + (GROUPS - 1);

export function generateEncryptionPassphrase(): string {
  const bytes = new Uint8Array(GROUPS * GROUP_LENGTH);
  crypto.getRandomValues(bytes);
  // Rejection sampling keeps the distribution uniform; the alphabet doesn't
  // divide 256 evenly.
  const limit = 256 - (256 % ALPHABET.length);
  const chars: string[] = [];
  let index = 0;
  while (chars.length < bytes.length) {
    if (index >= bytes.length) {
      crypto.getRandomValues(bytes);
      index = 0;
    }
    const value = bytes[index++]!;
    if (value < limit) chars.push(ALPHABET[value % ALPHABET.length]!);
  }
  const groups: string[] = [];
  for (let group = 0; group < GROUPS; group += 1) {
    groups.push(
      chars.slice(group * GROUP_LENGTH, (group + 1) * GROUP_LENGTH).join(""),
    );
  }
  return groups.join("-");
}
