import bcrypt from "bcryptjs";

const ROUNDS = 11;

export const PASSWORD_MIN_LENGTH = 3;
export const PASSWORD_MAX_LENGTH = 15;

/** Returns an API error string if length is invalid, otherwise null. */
export function passwordLengthError(plain: string): string | null {
  if (plain.length < PASSWORD_MIN_LENGTH || plain.length > PASSWORD_MAX_LENGTH) {
    return "password must be between 3 and 15 characters";
  }
  return null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}
