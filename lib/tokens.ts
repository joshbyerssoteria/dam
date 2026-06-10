import { customAlphabet } from "nanoid";
import bcrypt from "bcryptjs";

// URL-safe, unambiguous alphabet; 16 chars per spec.
const alphabet =
  "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 16);

export function generateShareToken(): string {
  return generate();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** A token (share or upload) is live when its expiry is unset or in the future. */
export function isTokenLive(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}
