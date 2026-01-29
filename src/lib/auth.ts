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
 * Create a session token that includes the user ID
 * Format: base64(userId:randomToken)
 */
export function createSessionToken(userId: string): string {
  const randomPart = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const payload = `${userId}:${randomPart}`;
  return Buffer.from(payload).toString('base64');
}

/**
 * Extract user ID from session token
 */
export function parseSessionToken(token: string): string | null {
  if (!token || token.length < 10) return null;
  
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    // Valid tokens have format: userId:randomToken
    if (!decoded.includes(':')) return null;
    
    const [userId] = decoded.split(':');
    // User IDs should be non-empty and look like UUIDs or simple IDs
    if (!userId || userId.length < 1) return null;
    
    return userId;
  } catch {
    return null;
  }
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
 */
export async function isAuthenticated(): Promise<boolean> {
  const userId = await getUserId();
  return !!userId;
}

/**
 * Get the current user's ID from the session cookie
 */
export async function getUserId(): Promise<string | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  return parseSessionToken(token);
}
