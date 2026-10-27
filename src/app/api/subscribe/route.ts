import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateId } from '@/lib/ulid';
import { generateConfirmationToken, generateConfirmationUrl } from '@/lib/signatures';
import { identifySubscriber, sendTransactionalEmail } from '@/lib/customerio';

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many subscription attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const existing = await query<{ id: string; status: string }>(
      'SELECT id, status FROM subscribers WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      const subscriber = existing.rows[0];
      
      if (subscriber.status === 'active') {
        return NextResponse.json(
          { message: 'This email is already subscribed!' },
          { status: 200 }
        );
      }

      if (subscriber.status === 'unsubscribed') {
        try {
          const confirmationToken = generateConfirmationToken(subscriber.id, normalizedEmail);
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          await query(
            `UPDATE subscribers 
             SET status = 'pending', 
                 confirmation_token = $1, 
                 confirmation_expires_at = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [confirmationToken, expiresAt, subscriber.id]
          );

          await sendConfirmationEmail(subscriber.id, normalizedEmail, confirmationToken);
        } catch (resubError) {
          console.error('[API /subscribe] Resubscribe flow error (non-fatal):', {
            error: resubError instanceof Error ? resubError.message : String(resubError),
            subscriberId: subscriber.id,
          });
        }

        return NextResponse.json({
          message: 'Please check your email to confirm your subscription.',
        });
      }

      return NextResponse.json({
        message: 'Please check your email to confirm your subscription.',
      });
    }

    let subscriberId: string;
    let confirmationToken: string;
    
    try {
      subscriberId = generateId();
      confirmationToken = generateConfirmationToken(subscriberId, normalizedEmail);
    } catch (tokenError) {
      console.error('[API /subscribe] Token generation failed:', {
        error: tokenError instanceof Error ? tokenError.message : String(tokenError),
      });
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO subscribers (id, email, status, confirmation_token, confirmation_expires_at, created_at, updated_at)
       VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())`,
      [subscriberId, normalizedEmail, confirmationToken, expiresAt]
    );

    try {
      await identifySubscriber(subscriberId, {
        email: normalizedEmail,
        subscription_status: 'pending',
      });
    } catch (cioError) {
      console.warn('[API /subscribe] Customer.io identify failed (non-fatal):', {
        error: cioError instanceof Error ? cioError.message : String(cioError),
        subscriberId,
      });
    }

    try {
      await sendConfirmationEmail(subscriberId, normalizedEmail, confirmationToken);
    } catch (emailError) {
      console.warn('[API /subscribe] Confirmation email failed (non-fatal):', {
        error: emailError instanceof Error ? emailError.message : String(emailError),
        subscriberId,
      });
    }

    return NextResponse.json({
      message: 'Please check your email to confirm your subscription.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown';
    
    console.error('[API /subscribe POST]', {
      error: errorName,
      message: errorMessage,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : '',
      timestamp: new Date().toISOString(),
    });
    
    // TODO: remove production details after subscribe verified
    return NextResponse.json(
      { error: 'An error occurred. Please try again.', details: errorMessage.substring(0, 300) },
      { status: 500 }
    );
  }
}

async function sendConfirmationEmail(
  subscriberId: string,
  email: string,
  token: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const confirmUrl = generateConfirmationUrl(baseUrl, subscriberId, token);

  try {
    const transactionalMessageId = process.env.CUSTOMERIO_CONFIRM_MESSAGE_ID;
    
    if (transactionalMessageId) {
      await sendTransactionalEmail({
        transactionalMessageId,
        to: email,
        identifiers: { id: subscriberId },
        messageData: {
          confirm_url: confirmUrl,
        },
      });
    } else {
      console.log('[DEV] Confirmation email would be sent to:', email);
      console.log('[DEV] Confirmation URL:', confirmUrl);
    }
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
  }
}
