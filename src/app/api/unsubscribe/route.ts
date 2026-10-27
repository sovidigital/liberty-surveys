import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/signatures';
import { identifySubscriber, trackEvent } from '@/lib/customerio';
import { Subscriber } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get('id');
    const token = searchParams.get('token');

    if (!subscriberId || !token) {
      return NextResponse.redirect(new URL('/unsubscribe?error=invalid', request.url));
    }

    const result = await query<Subscriber>(
      'SELECT id, email, status FROM subscribers WHERE id = $1',
      [subscriberId]
    );

    if (result.rows.length === 0) {
      return NextResponse.redirect(new URL('/unsubscribe?error=not_found', request.url));
    }

    const subscriber = result.rows[0];

    if (!verifyUnsubscribeToken(subscriberId, subscriber.email, token)) {
      return NextResponse.redirect(new URL('/unsubscribe?error=invalid_token', request.url));
    }

    if (subscriber.status === 'unsubscribed') {
      return NextResponse.redirect(new URL('/unsubscribe?status=already_unsubscribed', request.url));
    }

    const now = new Date();
    await query(
      `UPDATE subscribers 
       SET status = 'unsubscribed', 
           unsubscribed_at = $1,
           updated_at = $1
       WHERE id = $2`,
      [now, subscriberId]
    );

    await identifySubscriber(subscriberId, {
      email: subscriber.email,
      subscription_status: 'unsubscribed',
      unsubscribed_at: Math.floor(now.getTime() / 1000),
    });

    await trackEvent(subscriberId, 'unsubscribed', {
      unsubscribed_at: now.toISOString(),
    });

    return NextResponse.redirect(new URL('/unsubscribe?status=success', request.url));
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.redirect(new URL('/unsubscribe?error=server', request.url));
  }
}
