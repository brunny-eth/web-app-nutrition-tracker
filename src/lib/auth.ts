import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'nutrition_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a simple session token
 * For single-user app, we just need to verify they entered the password
 */
export function createSessionToken(): string {
  // Simple random token - not cryptographically critical for single-user app
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Set the session cookie (server-side)
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

/**
 * Get the session cookie (server-side)
 */
export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Clear the session cookie (server-side)
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if user is authenticated (server-side)
 * For single-user, we just check if session cookie exists
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionCookie();
  return !!token;
}
