import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { generateId } from '@/lib/ulid';
import { identifySubscriber } from '@/lib/customerio';

const WEBHOOK_SECRET = process.env.CUSTOMERIO_WEBHOOK_SECRET;

// Customer.io reporting webhook payload format
// See: https://docs.customer.io/integrations/data-out/connections/webhooks/
interface WebhookPayload {
  object_type: string;
  metric: string;
  timestamp: number;
  event_id: string;
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

/**
 * Verify Customer.io webhook signature.
 * 
 * CIO signs webhooks with HMAC-SHA256 over: "v0:<timestamp>:<raw body>"
 * Headers: X-CIO-Timestamp (unix seconds), X-CIO-Signature (hex digest)
 * 
 * See: https://docs.customer.io/integrations/data-out/connections/webhooks/#securely-verify-requests
 */
function verifySignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] CUSTOMERIO_WEBHOOK_SECRET not set, skipping signature verification');
    return true;
  }
  
  if (!signature) {
    console.error('[Webhook] Missing X-CIO-Signature header');
    return false;
  }
  
  if (!timestamp) {
    console.error('[Webhook] Missing X-CIO-Timestamp header');
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(`v0:${timestamp}:`);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Upsert a subscriber into DSQL from CIO webhook data.
 * 
 * IMPORTANT: To avoid creating duplicate CIO people:
 * 1. First check if email already exists in DSQL - use existing DSQL ID
 * 2. If not, use the CIO person's identifiers.id as the DSQL subscriber ID
 * 3. Only generate a new ID if no CIO ID is provided
 * 
 * This ensures that when we call Track API identify(), we use the same ID
 * that CIO already has for this person, avoiding duplicates.
 */
async function upsertSubscriber(
  cioPersonId: string,
  email: string,
  status: 'active' | 'unsubscribed',
  source: string
): Promise<{ id: string; isNew: boolean; shouldIdentify: boolean }> {
  const normalizedEmail = email.toLowerCase();
  
  const existingByEmail = await query<{ id: string; status: string }>(
    'SELECT id, status FROM subscribers WHERE email = $1',
    [normalizedEmail]
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
    
    console.log(`[Webhook] Updated existing subscriber ${existing.id} (${normalizedEmail}) to ${status} from ${source}`);
    return { id: existing.id, isNew: false, shouldIdentify: false };
  }
  
  // Use CIO person's external ID (identifiers.id) if provided
  // This is critical to avoid creating duplicate people in CIO
  let subscriberId: string;
  let shouldIdentify = false;
  
  if (cioPersonId && cioPersonId.length > 0) {
    subscriberId = cioPersonId;
    // Check if this ID already exists (shouldn't happen but be safe)
    const existingById = await query<{ id: string }>(
      'SELECT id FROM subscribers WHERE id = $1',
      [subscriberId]
    );
    if (existingById.rows.length > 0) {
      // ID exists but email doesn't match - update the existing record
      await query(
        `UPDATE subscribers 
         SET email = $1, status = $2, subscribed_at = COALESCE(subscribed_at, $3), updated_at = $3
         WHERE id = $4`,
        [normalizedEmail, status, now, subscriberId]
      );
      console.log(`[Webhook] Updated subscriber ${subscriberId} email to ${normalizedEmail} from ${source}`);
      return { id: subscriberId, isNew: false, shouldIdentify: false };
    }
  } else {
    // No CIO ID provided - generate one (this should be rare)
    subscriberId = generateId();
    // We'll need to identify back so CIO knows our ID
    shouldIdentify = true;
    console.warn(`[Webhook] No CIO person ID provided for ${normalizedEmail}, generated ${subscriberId}`);
  }
  
  await query(
    `INSERT INTO subscribers (id, email, status, subscribed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [subscriberId, normalizedEmail, status, status === 'active' ? now : null, now]
  );
  
  console.log(`[Webhook] Created new subscriber ${subscriberId} (${normalizedEmail}) as ${status} from ${source}`);
  return { id: subscriberId, isNew: true, shouldIdentify };
}

async function handleCustomerSubscribed(data: WebhookPayload['data']): Promise<void> {
  const email = data.email_address || data.identifiers?.email;
  // Use identifiers.id (the external person ID), NOT cio_id (internal hex)
  const cioPersonId = data.identifiers?.id || data.customer_id;
  
  if (!email) {
    console.warn('[Webhook] customer subscribed event missing email');
    return;
  }
  
  const { id, shouldIdentify } = await upsertSubscriber(
    cioPersonId || '',
    email,
    'active',
    'customer subscribed webhook'
  );
  
  // Only identify back if we generated a new ID (to sync it to CIO)
  // Otherwise, CIO already has this person with the correct ID
  if (shouldIdentify) {
    try {
      await identifySubscriber(id, {
        email: email.toLowerCase(),
        subscription_status: 'active',
        subscribed_at: Math.floor(Date.now() / 1000),
      });
      console.log(`[Webhook] Identified new subscriber ${id} to CIO`);
    } catch (error) {
      console.warn('[Webhook] Failed to identify to CIO:', error);
    }
  }
}

async function handleCustomerUnsubscribed(data: WebhookPayload['data']): Promise<void> {
  const email = data.email_address || data.identifiers?.email;
  const cioPersonId = data.identifiers?.id || data.customer_id;
  
  if (!email) {
    console.warn('[Webhook] customer unsubscribed event missing email');
    return;
  }
  
  const { id, shouldIdentify } = await upsertSubscriber(
    cioPersonId || '',
    email,
    'unsubscribed',
    'customer unsubscribed webhook'
  );
  
  if (shouldIdentify) {
    try {
      await identifySubscriber(id, {
        email: email.toLowerCase(),
        subscription_status: 'unsubscribed',
        unsubscribed_at: Math.floor(Date.now() / 1000),
      });
      console.log(`[Webhook] Identified unsubscribed ${id} to CIO`);
    } catch (error) {
      console.warn('[Webhook] Failed to identify to CIO:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-cio-signature');
    const timestamp = request.headers.get('x-cio-timestamp');
    
    if (!verifySignature(rawBody, timestamp, signature)) {
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
    
    // CIO webhooks use object_type + metric, not event_type
    const eventType = `${payload.object_type}_${payload.metric}`;
    console.log(`[Webhook] Received ${eventType} event (id: ${payload.event_id})`);
    
    switch (eventType) {
      case 'customer_subscribed':
        await handleCustomerSubscribed(payload.data);
        break;
        
      case 'customer_unsubscribed':
        await handleCustomerUnsubscribed(payload.data);
        break;
        
      default:
        console.log(`[Webhook] Ignoring event type: ${eventType}`);
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
      events: ['customer_subscribed', 'customer_unsubscribed'],
      headers: {
        'X-CIO-Signature': 'HMAC-SHA256 hex digest of v0:<timestamp>:<body>',
        'X-CIO-Timestamp': 'Unix timestamp when request was sent',
      },
      signature_format: 'HMAC-SHA256(secret, "v0:<X-CIO-Timestamp>:<raw body>")',
    },
    docs: 'https://docs.customer.io/integrations/data-out/connections/webhooks/',
  });
}
