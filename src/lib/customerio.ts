const TRACK_API_BASE = 'https://track.customer.io/api/v1';
const APP_API_BASE = 'https://api.customer.io/v1';

interface CustomerioConfig {
  siteId: string;
  apiKey: string;
  appApiKey?: string;
}

function getConfig(): CustomerioConfig {
  const siteId = process.env.CUSTOMERIO_SITE_ID;
  const apiKey = process.env.CUSTOMERIO_API_KEY;
  const appApiKey = process.env.CUSTOMERIO_APP_API_KEY;

  if (!siteId || !apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Customer.io] Credentials not set, using mock mode');
      return { siteId: 'mock', apiKey: 'mock', appApiKey: 'mock' };
    }
    throw new Error('CUSTOMERIO_SITE_ID and CUSTOMERIO_API_KEY must be set');
  }

  return { siteId, apiKey, appApiKey };
}

function getTrackAuthHeader(): string {
  const { siteId, apiKey } = getConfig();
  return 'Basic ' + Buffer.from(`${siteId}:${apiKey}`).toString('base64');
}

function getAppAuthHeader(): string {
  const { appApiKey } = getConfig();
  if (!appApiKey) {
    throw new Error('CUSTOMERIO_APP_API_KEY must be set for transactional sends');
  }
  return `Bearer ${appApiKey}`;
}

async function trackApiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const config = getConfig();
  
  if (config.siteId === 'mock') {
    console.log(`[Customer.io MOCK] ${method} ${path}`, body);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  const response = await fetch(`${TRACK_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': getTrackAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Customer.io] Track API error: ${response.status}`, error);
    throw new Error(`Customer.io Track API error: ${response.status} ${error}`);
  }

  return response;
}

async function appApiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const config = getConfig();
  
  if (config.siteId === 'mock') {
    console.log(`[Customer.io MOCK] App API ${method} ${path}`, body);
    return new Response(JSON.stringify({ delivery_id: 'mock-delivery-id' }), { status: 200 });
  }

  const response = await fetch(`${APP_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': getAppAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Customer.io] App API error: ${response.status}`, error);
    throw new Error(`Customer.io App API error: ${response.status} ${error}`);
  }

  return response;
}

export interface SubscriberAttributes {
  email: string;
  subscription_status: 'pending' | 'active' | 'unsubscribed';
  subscribed_at?: number;
  unsubscribed_at?: number;
  total_polls_voted?: number;
  last_vote_at?: number;
}

export async function identifySubscriber(
  subscriberId: string,
  attributes: SubscriberAttributes
): Promise<void> {
  await trackApiRequest('PUT', `/customers/${subscriberId}`, attributes as unknown as Record<string, unknown>);
}

export async function trackEvent(
  subscriberId: string,
  eventName: string,
  data?: Record<string, unknown>
): Promise<void> {
  await trackApiRequest('POST', `/customers/${subscriberId}/events`, {
    name: eventName,
    data: data || {},
  });
}

export async function deleteSubscriber(subscriberId: string): Promise<void> {
  await trackApiRequest('DELETE', `/customers/${subscriberId}`);
}

export interface TransactionalEmailOptions {
  transactionalMessageId: string | number;
  to: string;
  identifiers: { id: string };
  messageData?: Record<string, unknown>;
  sendToUnsubscribed?: boolean;
}

export async function sendTransactionalEmail(options: TransactionalEmailOptions): Promise<string> {
  const response = await appApiRequest('POST', '/send/email', {
    transactional_message_id: options.transactionalMessageId,
    to: options.to,
    identifiers: options.identifiers,
    message_data: options.messageData || {},
    send_to_unsubscribed: options.sendToUnsubscribed || false,
  });

  const result = await response.json();
  return result.delivery_id;
}

export interface BroadcastTriggerOptions {
  campaignId: number;
  recipients?: Record<string, unknown>;
  ids?: string[];
  data?: Record<string, unknown>;
}

export async function triggerBroadcast(
  environmentId: string,
  options: BroadcastTriggerOptions
): Promise<void> {
  const body: Record<string, unknown> = {
    data: options.data || {},
  };

  if (options.recipients) {
    body.recipients = options.recipients;
  } else if (options.ids) {
    body.ids = options.ids;
  }

  await appApiRequest(
    'POST',
    `/environments/${environmentId}/campaigns/${options.campaignId}/triggers`,
    body
  );
}

export const customerio = {
  identifySubscriber,
  trackEvent,
  deleteSubscriber,
  sendTransactionalEmail,
  triggerBroadcast,
};

export default customerio;
