import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { identifySubscriber, trackEvent } from '@/lib/customerio';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get('id');
    const token = searchParams.get('token');

    if (!subscriberId || !token) {
      return NextResponse.redirect(new URL('/confirm?error=invalid', request.url));
    }

    const result = await query<{
      id: string;
      email: string;
      status: string;
      confirmation_token: string | null;
      confirmation_expires_at: Date | null;
    }>(
      `SELECT id, email, status, confirmation_token, confirmation_expires_at 
       FROM subscribers 
       WHERE id = $1`,
      [subscriberId]
    );

    if (result.rows.length === 0) {
      return NextResponse.redirect(new URL('/confirm?error=not_found', request.url));
    }

    const subscriber = result.rows[0];

    if (subscriber.status === 'active') {
      return NextResponse.redirect(new URL('/confirm?status=already_confirmed', request.url));
    }

    if (subscriber.confirmation_token !== token) {
      return NextResponse.redirect(new URL('/confirm?error=invalid_token', request.url));
    }

    if (subscriber.confirmation_expires_at && new Date() > subscriber.confirmation_expires_at) {
      return NextResponse.redirect(new URL('/confirm?error=expired', request.url));
    }

    const now = new Date();
    await query(
      `UPDATE subscribers 
       SET status = 'active', 
           confirmation_token = NULL, 
           confirmation_expires_at = NULL,
           subscribed_at = $1,
           updated_at = $1
       WHERE id = $2`,
      [now, subscriberId]
    );

    await identifySubscriber(subscriberId, {
      email: subscriber.email,
      subscription_status: 'active',
      subscribed_at: Math.floor(now.getTime() / 1000),
    });

    await trackEvent(subscriberId, 'subscription_confirmed', {
      confirmed_at: now.toISOString(),
    });

    return NextResponse.redirect(new URL('/confirm?status=success', request.url));
  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.redirect(new URL('/confirm?error=server', request.url));
  }
}
