import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { generateId } from '@/lib/ulid';
import { identifySubscriber } from '@/lib/customerio';

const WEBHOOK_SECRET = process.env.CUSTOMERIO_WEBHOOK_SECRET;

interface WebhookPayload {
  event_type: string;
  timestamp: number;
  data: {
    customer_id?: string;
    email_address?: string;
    identifiers?: {
      id?: string;
      cio_id?: string;
      email?: string;
    };
    attributes?: Record<string, unknown>;
    action_id?: number;
    delivery_id?: string;
  };
}

function verifySignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] CUSTOMERIO_WEBHOOK_SECRET not set, skipping signature verification');
    return true;
  }
  
  if (!signature) {
    console.error('[Webhook] Missing x-cio-signature header');
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

async function upsertSubscriber(
  cioId: string,
  email: string,
  status: 'active' | 'unsubscribed',
  source: string
): Promise<{ id: string; isNew: boolean }> {
  const existingByEmail = await query<{ id: string; status: string }>(
    'SELECT id, status FROM subscribers WHERE email = $1',
    [email.toLowerCase()]
  );
  
  const now = new Date();
  
  if (existingByEmail.rows.length > 0) {
    const existing = existingByEmail.rows[0];
    
    if (status === 'unsubscribed') {
      await query(
        `UPDATE subscribers 
         SET status = 'unsubscribed', 
             unsubscribed_at = $1,
             updated_at = $1
         WHERE id = $2`,
        [now, existing.id]
      );
    } else if (status === 'active' && existing.status !== 'active') {
      await query(
        `UPDATE subscribers 
         SET status = 'active', 
             subscribed_at = COALESCE(subscribed_at, $1),
             unsubscribed_at = NULL,
             updated_at = $1
         WHERE id = $2`,
        [now, existing.id]
      );
    }
    
    console.log(`[Webhook] Updated existing subscriber ${existing.id} (${email}) to ${status} from ${source}`);
    return { id: existing.id, isNew: false };
  }
  
  const subscriberId = cioId.startsWith('cio_') ? cioId.slice(4) : cioId;
  const newId = subscriberId.length >= 8 ? subscriberId : generateId();
  
  const existingById = await query<{ id: string }>(
    'SELECT id FROM subscribers WHERE id = $1',
    [newId]
  );
  
  const finalId = existingById.rows.length > 0 ? generateId() : newId;
  
  await query(
    `INSERT INTO subscribers (id, email, status, subscribed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [finalId, email.toLowerCase(), status, status === 'active' ? now : null, now]
  );
  
  console.log(`[Webhook] Created new subscriber ${finalId} (${email}) as ${status} from ${source}`);
  return { id: finalId, isNew: true };
}

async function handleCustomerSubscribed(data: WebhookPayload['data']): Promise<void> {
  const email = data.email_address || data.identifiers?.email;
  const cioId = data.identifiers?.cio_id || data.customer_id;
  
  if (!email) {
    console.warn('[Webhook] customer_subscribed event missing email');
    return;
  }
  
  const { id, isNew } = await upsertSubscriber(
    cioId || '',
    email,
    'active',
    'customer_subscribed webhook'
  );
  
  try {
    await identifySubscriber(id, {
      email: email.toLowerCase(),
      subscription_status: 'active',
      subscribed_at: Math.floor(Date.now() / 1000),
    });
    console.log(`[Webhook] Synced subscriber ${id} back to CIO`);
  } catch (error) {
    console.warn('[Webhook] Failed to identify back to CIO:', error);
  }
}

async function handleCustomerUnsubscribed(data: WebhookPayload['data']): Promise<void> {
  const email = data.email_address || data.identifiers?.email;
  const cioId = data.identifiers?.cio_id || data.customer_id;
  
  if (!email) {
    console.warn('[Webhook] customer_unsubscribed event missing email');
    return;
  }
  
  const { id } = await upsertSubscriber(
    cioId || '',
    email,
    'unsubscribed',
    'customer_unsubscribed webhook'
  );
  
  try {
    await identifySubscriber(id, {
      email: email.toLowerCase(),
      subscription_status: 'unsubscribed',
      unsubscribed_at: Math.floor(Date.now() / 1000),
    });
    console.log(`[Webhook] Synced unsubscribe for ${id} back to CIO`);
  } catch (error) {
    console.warn('[Webhook] Failed to identify back to CIO:', error);
  }
}

async function handleCustomerCreated(data: WebhookPayload['data']): Promise<void> {
  const email = data.email_address || data.identifiers?.email;
  const cioId = data.identifiers?.cio_id || data.customer_id;
  
  if (!email) {
    console.log('[Webhook] customer event without email, skipping');
    return;
  }
  
  const { id } = await upsertSubscriber(
    cioId || '',
    email,
    'active',
    'customer webhook'
  );
  
  try {
    await identifySubscriber(id, {
      email: email.toLowerCase(),
      subscription_status: 'active',
      subscribed_at: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    console.warn('[Webhook] Failed to identify back to CIO:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-cio-signature');
    
    if (!verifySignature(rawBody, signature)) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Webhook] Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    console.log(`[Webhook] Received ${payload.event_type} event`);
    
    switch (payload.event_type) {
      case 'customer_subscribed':
        await handleCustomerSubscribed(payload.data);
        break;
        
      case 'customer_unsubscribed':
        await handleCustomerUnsubscribed(payload.data);
        break;
        
      case 'customer':
        await handleCustomerCreated(payload.data);
        break;
        
      default:
        console.log(`[Webhook] Ignoring event type: ${payload.event_type}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Customer.io Webhook Endpoint',
    usage: {
      description: 'Receives Customer.io reporting webhooks for subscriber sync',
      events: ['customer_subscribed', 'customer_unsubscribed', 'customer'],
      headers: {
        'x-cio-signature': 'HMAC-SHA256 signature of the request body',
      },
    },
  });
}
