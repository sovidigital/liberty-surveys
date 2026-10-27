import crypto from 'crypto';

const VOTE_SECRET = process.env.VOTE_SIGNING_SECRET || 'dev-vote-secret-change-in-production';
const CONFIRM_SECRET = process.env.CONFIRM_SIGNING_SECRET || 'dev-confirm-secret-change-in-production';
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SIGNING_SECRET || 'dev-unsubscribe-secret-change-in-production';

function hmacSign(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function generateVoteSignature(pollId: string, optionId: string, subscriberId: string): string {
  const payload = `vote:${pollId}:${optionId}:${subscriberId}`;
  return hmacSign(VOTE_SECRET, payload);
}

export function verifyVoteSignature(
  pollId: string,
  optionId: string,
  subscriberId: string,
  signature: string
): boolean {
  const expected = generateVoteSignature(pollId, optionId, subscriberId);
  return timingSafeCompare(expected, signature);
}

export function generateVoteUrl(
  baseUrl: string,
  pollId: string,
  optionId: string,
  subscriberId: string
): string {
  const signature = generateVoteSignature(pollId, optionId, subscriberId);
  const params = new URLSearchParams({
    p: pollId,
    o: optionId,
    s: subscriberId,
    sig: signature,
  });
  return `${baseUrl}/api/vote?${params.toString()}`;
}

export function generateConfirmationToken(subscriberId: string, email: string): string {
  const payload = `confirm:${subscriberId}:${email}:${Date.now()}`;
  return hmacSign(CONFIRM_SECRET, payload);
}

export function generateConfirmationUrl(baseUrl: string, subscriberId: string, token: string): string {
  const params = new URLSearchParams({
    id: subscriberId,
    token,
  });
  return `${baseUrl}/api/confirm?${params.toString()}`;
}

export function generateUnsubscribeToken(subscriberId: string, email: string): string {
  const payload = `unsubscribe:${subscriberId}:${email}`;
  return hmacSign(UNSUBSCRIBE_SECRET, payload);
}

export function verifyUnsubscribeToken(subscriberId: string, email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(subscriberId, email);
  return timingSafeCompare(expected, token);
}

export function generateUnsubscribeUrl(baseUrl: string, subscriberId: string, email: string): string {
  const token = generateUnsubscribeToken(subscriberId, email);
  const params = new URLSearchParams({
    id: subscriberId,
    token,
  });
  return `${baseUrl}/api/unsubscribe?${params.toString()}`;
}
