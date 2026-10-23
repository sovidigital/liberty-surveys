export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed';
export type PollStatus = 'draft' | 'scheduled' | 'active' | 'closed';

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  confirmation_token: string | null;
  confirmation_expires_at: Date | null;
  subscribed_at: Date | null;
  unsubscribed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Poll {
  id: string;
  question: string;
  status: PollStatus;
  scheduled_for: Date | null;
  published_at: Date | null;
  closed_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  display_order: number;
  created_at: Date;
}

export interface Vote {
  id: string;
  poll_id: string;
  option_id: string;
  subscriber_id: string;
  voted_at: Date;
}

export interface AdminUser {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
}

export interface PollResults {
  poll: Poll;
  options: Array<PollOption & { vote_count: number }>;
  total_votes: number;
}

export interface VoteSignaturePayload {
  pollId: string;
  optionId: string;
  subscriberId: string;
}

export interface ConfirmationPayload {
  subscriberId: string;
  email: string;
}
