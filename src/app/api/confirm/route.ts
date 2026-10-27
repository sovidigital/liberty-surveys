import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { identifySubscriber, trackEvent } from '@/lib/customerio';
import { buildRedirectUrl } from '@/lib/url';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get('id');
    const token = searchParams.get('token');

    if (!subscriberId || !token) {
      return NextResponse.redirect(buildRedirectUrl(request, '/confirm?error=invalid'));
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
      return NextResponse.redirect(buildRedirectUrl(request, '/confirm?error=not_found'));
    }

    const subscriber = result.rows[0];

    if (subscriber.status === 'active') {
      return NextResponse.redirect(buildRedirectUrl(request, '/confirm?status=already_confirmed'));
    }

    if (subscriber.confirmation_token !== token) {
      return NextResponse.redirect(buildRedirectUrl(request, '/confirm?error=invalid_token'));
    }

    if (subscriber.confirmation_expires_at && new Date() > subscriber.confirmation_expires_at) {
      return NextResponse.redirect(buildRedirectUrl(request, '/confirm?error=expired'));
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

    return NextResponse.redirect(buildRedirectUrl(request, '/confirm?status=success'));
  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.redirect(buildRedirectUrl(request, '/confirm?error=server'));
  }
}
