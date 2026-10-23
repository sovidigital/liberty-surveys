import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from './db';
import { AdminUser } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-32chars!'
);
const SESSION_COOKIE_NAME = 'liberty_admin_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const MOCK_MODE = process.env.USE_MOCK_DB === 'true';
const MOCK_ADMIN_EMAIL = 'admin@example.com';
const MOCK_ADMIN_PASSWORD = 'admin123';
const MOCK_ADMIN_ID = 'mock-admin-001';

interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, email: string): Promise<string> {
  const token = await new SignJWT({ userId, email } as SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return null;
  }

  return verifySession(sessionCookie.value);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function authenticateAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const normalizedEmail = email.toLowerCase();

  // In mock mode, ONLY allow the hardcoded test credentials
  // This is intentionally separate from production auth
  if (MOCK_MODE) {
    if (normalizedEmail === MOCK_ADMIN_EMAIL && password === MOCK_ADMIN_PASSWORD) {
      console.log('[MOCK AUTH] Admin authenticated with test credentials');
      return { success: true, userId: MOCK_ADMIN_ID };
    }
    return { success: false, error: 'Invalid email or password' };
  }

  // Production mode: authenticate against the database
  // Requires ADMIN_EMAIL and password to be configured properly in the database
  try {
    const result = await query<AdminUser>(
      'SELECT id, email, password_hash FROM admin_users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid email or password' };
    }

    const admin = result.rows[0];
    const isValid = await verifyPassword(password, admin.password_hash);

    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    return { success: true, userId: admin.id };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export function isMockMode(): boolean {
  return MOCK_MODE;
}
