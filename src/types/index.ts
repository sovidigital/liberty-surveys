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

// ============================================================================
// Automated Poll Generation Types
// ============================================================================

export type PoliticalLean = 'left' | 'center-left' | 'center' | 'center-right' | 'right';
export type PerspectiveType = 'background' | 'conservative' | 'liberal' | 'centrist';
export type GenerationStatus = 'pending' | 'fetching_news' | 'selecting_topic' | 'generating' | 'validating' | 'success' | 'failed' | 'fallback';

export interface PollBriefing {
  background: string;
  conservative: string;
  liberal: string;
  centrist: string;
}

export interface PollWithBriefing extends Poll {
  briefing_background: string | null;
  briefing_conservative: string | null;
  briefing_liberal: string | null;
  briefing_centrist: string | null;
  generation_run_id: string | null;
  is_auto_generated: boolean;
}

export interface PollSource {
  id: string;
  poll_id: string;
  source_name: string;
  source_url: string;
  article_title: string | null;
  article_snippet: string | null;
  political_lean: PoliticalLean | null;
  perspective_used: PerspectiveType | null;
  fetched_at: Date | null;
  created_at: Date;
}

export interface GenerationRun {
  id: string;
  run_date: Date;
  status: GenerationStatus;
  selected_topic: string | null;
  topic_reason: string | null;
  candidate_topics_json: string | null;
  recent_topics_avoided: string | null;
  news_sources_queried: string | null;
  articles_fetched_count: number;
  articles_used_count: number;
  generated_poll_id: string | null;
  model_used: string | null;
  generation_prompt_hash: string | null;
  bias_score: number | null;
  balance_score: number | null;
  citation_validity_score: number | null;
  retry_count: number;
  used_fallback: boolean;
  fallback_reason: string | null;
  error_message: string | null;
  raw_llm_input: string | null;
  raw_llm_output: string | null;
  bias_check_output: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface FetchedArticle {
  id: string;
  generation_run_id: string;
  source_name: string;
  source_url: string;
  article_title: string;
  article_description: string | null;
  article_content: string | null;
  published_at: Date | null;
  political_lean: PoliticalLean | null;
  topic_cluster: string | null;
  relevance_score: number | null;
  fetched_at: Date;
}

export interface EvergreenPoll {
  id: string;
  question: string;
  options_json: string;
  briefing_background: string | null;
  briefing_conservative: string | null;
  briefing_liberal: string | null;
  briefing_centrist: string | null;
  category: string | null;
  last_used_at: Date | null;
  use_count: number;
  is_active: boolean;
  created_at: Date;
}

// News fetching types
export interface NewsArticle {
  title: string;
  description: string;
  content: string | null;
  url: string;
  source: {
    name: string;
    politicalLean: PoliticalLean;
  };
  publishedAt: Date;
}

export interface TopicCluster {
  topic: string;
  keywords: string[];
  articles: NewsArticle[];
  prominenceScore: number;
  coverageBreadth: number;
  debatabilityScore: number;
}

// LLM generation types
export interface GeneratedPollOption {
  text: string;
}

export interface GeneratedPollSource {
  sourceName: string;
  sourceUrl: string;
  articleTitle: string;
  snippet: string;
  politicalLean: PoliticalLean;
  usedForPerspective: PerspectiveType;
}

export interface GeneratedPoll {
  question: string;
  options: GeneratedPollOption[];
  briefing: PollBriefing;
  sources: GeneratedPollSource[];
  topicSummary: string;
}

export interface BiasCheckResult {
  questionBiasScore: number;
  optionBalanceScore: number;
  perspectiveBalanceScore: number;
  overallScore: number;
  issues: string[];
  passesThreshold: boolean;
}

export interface GenerationResult {
  success: boolean;
  poll?: GeneratedPoll;
  biasCheck?: BiasCheckResult;
  runId: string;
  error?: string;
  usedFallback?: boolean;
}

// ============================================================================
// Nightly Recap Types
// ============================================================================

export type RecapStatus = 'pending' | 'sending' | 'sent' | 'skipped' | 'failed';

export interface RecapSend {
  id: string;
  poll_id: string;
  send_date: Date;
  status: RecapStatus;
  total_votes: number;
  vote_threshold: number;
  results_snapshot_json: string;
  broadcast_campaign_id: string | null;
  subscribers_sent_to: number | null;
  scheduled_for: Date | null;
  sent_at: Date | null;
  skipped: boolean;
  skip_reason: string | null;
  error_message: string | null;
  created_at: Date;
}

export interface RecapResultOption {
  optionText: string;
  percentage: number;
  displayOrder: number;
}

export interface RecapResultsSnapshot {
  question: string;
  options: RecapResultOption[];
  briefingExcerpt: string;
  resultsUrl: string;
}

export interface RecapSendResult {
  success: boolean;
  recapId: string;
  skipped?: boolean;
  skipReason?: string;
  subscriberCount?: number;
  error?: string;
}
