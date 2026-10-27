const TRACK_API_BASE = 'https://track.customer.io/api/v1';
const APP_API_BASE = 'https://api.customer.io/v1';

interface CustomerioConfig {
  siteId: string;
  apiKey: string;
  appApiKey?: string;
  environmentId?: string;
}

export interface CIOSegmentMember {
  id: string;
  internalId: string;
  email: string;
  attributes: Record<string, unknown>;
}

let configWarningLogged = false;

function getConfig(): CustomerioConfig {
  const siteId = process.env.CUSTOMERIO_SITE_ID;
  const apiKey = process.env.CUSTOMERIO_API_KEY;
  const appApiKey = process.env.CUSTOMERIO_APP_API_KEY;
  const environmentId = process.env.CUSTOMERIO_ENVIRONMENT_ID;

  if (!siteId || !apiKey) {
    if (!configWarningLogged) {
      console.warn('[Customer.io] Credentials not set, using mock mode. Set CUSTOMERIO_SITE_ID and CUSTOMERIO_API_KEY to enable.');
      configWarningLogged = true;
    }
    return { siteId: 'mock', apiKey: 'mock', appApiKey: 'mock', environmentId: 'mock' };
  }

  return { siteId, apiKey, appApiKey, environmentId };
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

// ============================================================================
// Broadcast Trigger (Low-level)
// ============================================================================

export interface BroadcastPerUserDataEntry {
  id: string;
  data: Record<string, unknown>;
}

export interface BroadcastTriggerOptions {
  campaignId: number;
  recipients?: Record<string, unknown>;
  ids?: string[];
  perUserData?: BroadcastPerUserDataEntry[];
  data?: Record<string, unknown>;
  idIgnoreMissing?: boolean;
  emailIgnoreMissing?: boolean;
}

export async function triggerBroadcast(
  options: BroadcastTriggerOptions
): Promise<void> {
  const body: Record<string, unknown> = {};

  if (options.data) {
    body.data = options.data;
  }

  if (options.recipients) {
    body.recipients = options.recipients;
  } else if (options.ids) {
    body.ids = options.ids;
  } else if (options.perUserData) {
    body.per_user_data = options.perUserData;
  }

  if (options.idIgnoreMissing) {
    body.id_ignore_missing = true;
  }
  if (options.emailIgnoreMissing) {
    body.email_ignore_missing = true;
  }

  await appApiRequest(
    'POST',
    `/campaigns/${options.campaignId}/triggers`,
    body
  );
}

// ============================================================================
// Daily Poll Broadcast (with briefing and per-user vote URLs)
// ============================================================================

export interface PollBroadcastOption {
  id: string;
  text: string;
  vote_url: string;
}

export interface PollBroadcastSharedData {
  poll_id: string;
  poll_question: string;
  results_url: string;
  briefing_background?: string;
  briefing_conservative?: string;
  briefing_liberal?: string;
  briefing_centrist?: string;
  sources?: Array<{
    name: string;
    url: string;
    title: string;
  }>;
}

export interface PollBroadcastSubscriberData {
  subscriber_id: string;
  email: string;
  options: PollBroadcastOption[];
  unsubscribe_url: string;
}

export interface PollBroadcastInput {
  sharedData: PollBroadcastSharedData;
  subscribers: PollBroadcastSubscriberData[];
}

export async function triggerPollBroadcast(
  input: PollBroadcastInput
): Promise<{ subscriberCount: number }> {
  const campaignId = process.env.CUSTOMERIO_BROADCAST_CAMPAIGN_ID;
  
  if (!campaignId) {
    console.warn('[Customer.io] Broadcast campaign ID not configured, skipping');
    return { subscriberCount: 0 };
  }
  
  const config = getConfig();
  
  if (config.siteId === 'mock') {
    console.log('[Customer.io MOCK] Poll broadcast triggered:', {
      sharedData: input.sharedData,
      subscriberCount: input.subscribers.length,
      sampleSubscriber: input.subscribers[0],
    });
    return { subscriberCount: input.subscribers.length };
  }
  
  const perUserData: BroadcastPerUserDataEntry[] = input.subscribers.map(sub => ({
    id: sub.subscriber_id,
    data: {
      options: sub.options,
      unsubscribe_url: sub.unsubscribe_url,
    },
  }));
  
  await triggerBroadcast({
    campaignId: parseInt(campaignId, 10),
    data: input.sharedData as unknown as Record<string, unknown>,
    perUserData,
    idIgnoreMissing: true,
  });
  
  return { subscriberCount: input.subscribers.length };
}

// ============================================================================
// Nightly Recap Broadcast
// ============================================================================

export interface RecapBroadcastData {
  poll_id: string;
  poll_question: string;
  results: Array<{
    text: string;
    percentage: number;
    bar_width: number;
  }>;
  briefing_excerpt?: string;
  results_url: string;
}

export async function triggerRecapBroadcast(
  campaignId: string,
  data: RecapBroadcastData
): Promise<{ subscriberCount: number }> {
  const config = getConfig();
  
  if (config.siteId === 'mock') {
    console.log('[Customer.io MOCK] Recap broadcast triggered:', data);
    return { subscriberCount: 100 };
  }
  
  await triggerBroadcast({
    campaignId: parseInt(campaignId, 10),
    data: data as unknown as Record<string, unknown>,
  });
  
  return { subscriberCount: -1 };
}

// ============================================================================
// Segment Member Fetching
// ============================================================================
// 
// Uses App API endpoint: GET /v1/segments/{segment_id}/membership
// Docs: https://docs.customer.io/integrations/api/app/tag/segments/
// Auth: Bearer CUSTOMERIO_APP_API_KEY (same as transactional sends)
// 
// NOTE: This does NOT use /environments/{env_id}/customers (Fly API) which
// requires different authentication and would 404 on api.customer.io.
// ============================================================================

interface CIOSegmentMembershipResponse {
  ids: string[];
  next: string;
}

interface CIOCustomerAttributesResponse {
  customer: {
    id: string;
    identifiers: {
      id?: string;
      email?: string;
      cio_id?: string;
    };
    attributes: Record<string, unknown>;
  };
}

export async function fetchSegmentMembers(segmentId: number): Promise<CIOSegmentMember[]> {
  const config = getConfig();
  
  if (config.siteId === 'mock') {
    console.log(`[Customer.io MOCK] Would fetch segment ${segmentId} members`);
    return [
      { id: 'mock-1', internalId: 'abc123', email: 'test1@example.com', attributes: {} },
      { id: 'mock-2', internalId: 'def456', email: 'test2@example.com', attributes: {} },
    ];
  }
  
  const members: CIOSegmentMember[] = [];
  let cursor: string | null = null;
  
  console.log(`[Customer.io] Fetching segment ${segmentId} members via App API...`);
  
  do {
    const url = cursor 
      ? `${APP_API_BASE}/segments/${segmentId}/membership?start=${cursor}`
      : `${APP_API_BASE}/segments/${segmentId}/membership`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': getAppAuthHeader(),
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[Customer.io] Segment membership fetch error: ${response.status}`, error);
      throw new Error(`Failed to fetch segment members: ${response.status} ${error}`);
    }
    
    const data: CIOSegmentMembershipResponse = await response.json();
    
    for (const customerId of data.ids) {
      try {
        const attrResponse = await fetch(`${APP_API_BASE}/customers/${customerId}/attributes`, {
          method: 'GET',
          headers: {
            'Authorization': getAppAuthHeader(),
          },
        });
        
        if (!attrResponse.ok) {
          console.warn(`[Customer.io] Failed to fetch attributes for ${customerId}`);
          continue;
        }
        
        const attrData: CIOCustomerAttributesResponse = await attrResponse.json();
        const customer = attrData.customer;
        
        const email = customer.identifiers.email || 
                     (customer.attributes.email as string) ||
                     '';
        
        if (!email) {
          console.warn(`[Customer.io] Skipping customer ${customerId} without email`);
          continue;
        }
        
        members.push({
          id: customer.identifiers.id || customerId,
          internalId: customer.identifiers.cio_id || customerId,
          email,
          attributes: customer.attributes,
        });
      } catch (err) {
        console.warn(`[Customer.io] Error fetching customer ${customerId}:`, err);
      }
    }
    
    cursor = data.next || null;
    
    if (members.length % 50 === 0 && members.length > 0) {
      console.log(`[Customer.io] Fetched ${members.length} members so far...`);
    }
  } while (cursor);
  
  console.log(`[Customer.io] Fetched ${members.length} members from segment ${segmentId}`);
  return members;
}

export const customerio = {
  identifySubscriber,
  trackEvent,
  deleteSubscriber,
  sendTransactionalEmail,
  triggerBroadcast,
  triggerPollBroadcast,
  triggerRecapBroadcast,
  fetchSegmentMembers,
};

export default customerio;
