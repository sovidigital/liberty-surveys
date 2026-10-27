import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, createSession, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await authenticateAdmin(email, password);

    if (!result.success || !result.userId) {
      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    const token = await createSession(result.userId, email);
    await setSessionCookie(token);

    return NextResponse.json({ 
      success: true,
      message: 'Logged in successfully' 
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
