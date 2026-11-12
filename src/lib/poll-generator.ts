import { query } from './db';
import { fetchNews, clusterArticlesByTopic, fetchArticlesForTopic } from './news';
import { 
  generatePoll, 
  checkPollBias, 
  validateCitations, 
  getModelId, 
  LlmTimeoutError, 
  getLlmTimeoutMs,
  EmptyLlmResponseError,
  JsonExtractionError,
} from './xai';
import { generateId } from './ulid';
import {
  GenerationRun,
  GenerationResult,
  TopicCluster,
  NewsArticle,
  GeneratedPoll,
  EvergreenPoll,
  BiasCheckResult,
} from '@/types';

// ============================================================================
// Configuration
// ============================================================================

const MAX_RETRIES = 3;
const MIN_ARTICLES_PER_TOPIC = 4;
const RECENT_TOPICS_DAYS = 7;

const MAX_ARTICLES_FOR_SPEED = 50;

// Multi-topic fallback: try additional topics before going to evergreen
export const MAX_TOPICS_TO_TRY = 3;

// Near-pass thresholds: drafts scoring close to passing can be published
// instead of using evergreen. A near-pass must have:
// - overallScore >= NEAR_PASS_OVERALL_THRESHOLD (vs 0.7 for full pass)
// - All individual scores >= NEAR_PASS_INDIVIDUAL_THRESHOLD (vs 0.5 for full pass)
export const NEAR_PASS_OVERALL_THRESHOLD = 0.6;
export const NEAR_PASS_INDIVIDUAL_THRESHOLD = 0.4;

// Generic political terms that appear in most poll questions and shouldn't alone
// trigger topic similarity. These describe broad categories, not specific stories.
// A cluster with topic "president" about a new tariff announcement shouldn't be
// blocked just because a recent poll question contained the word "president".
const GENERIC_POLITICAL_TERMS = new Set([
  'president',
  'house',
  'white house',
  'congress',
  'senate',
  'election',
  'vote',
  'administration',
  'government',
  'federal',
  'law',
  'bill',
  'policy',
  'decision',
  'legislation',
  'republican',
  'democrat',
  'gop',
  'party',
  'political',
  'washington',
  'capitol',
  'lawmaker',
  'official',
  'leader',
]);

const DEFAULT_GENERATION_TIMEOUT_MS = 240000; // 4 minutes default for standalone Lambda (5min limit)
const MIN_TIME_FOR_LLM_RETRY_MS = 30000; // Need at least 30s remaining to attempt another LLM call
const MIN_TIME_FOR_FALLBACK_MS = 10000; // Reserve 10s for evergreen fallback

function getGenerationTimeoutMs(): number {
  const envTimeout = process.env.GENERATION_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_GENERATION_TIMEOUT_MS;
}

function getTimeRemainingMs(startTime: number): number {
  return Math.max(0, getGenerationTimeoutMs() - (Date.now() - startTime));
}

function hasTimeForLlmRetry(startTime: number): boolean {
  return getTimeRemainingMs(startTime) >= MIN_TIME_FOR_LLM_RETRY_MS;
}

function hasTimeForFallback(startTime: number): boolean {
  return getTimeRemainingMs(startTime) >= MIN_TIME_FOR_FALLBACK_MS;
}

// ============================================================================
// Near-Pass Detection
// ============================================================================

interface NearPassDraft {
  poll: GeneratedPoll;
  biasResult: BiasCheckResult;
  topic: string;
  promptHash: string;
  rawInput: string;
  rawOutput: string;
}

/**
 * Checks if a bias check result qualifies as a "near-pass".
 * A near-pass is close enough to passing that it's preferable to using
 * an evergreen fallback poll, as it's still based on current news.
 * 
 * Near-pass criteria:
 * - overallScore >= 0.6 (10 points below the 0.7 pass threshold)
 * - All individual scores >= 0.4 (10 points below the 0.5 individual thresholds)
 */
export function isNearPass(biasResult: BiasCheckResult): boolean {
  return (
    biasResult.overallScore >= NEAR_PASS_OVERALL_THRESHOLD &&
    biasResult.questionBiasScore >= NEAR_PASS_INDIVIDUAL_THRESHOLD &&
    biasResult.optionBalanceScore >= NEAR_PASS_INDIVIDUAL_THRESHOLD &&
    biasResult.perspectiveBalanceScore >= NEAR_PASS_INDIVIDUAL_THRESHOLD
  );
}

/**
 * Compares two bias results to determine which is better.
 * Returns true if `a` is better than `b`.
 */
function isBetterBiasResult(a: BiasCheckResult, b: BiasCheckResult | null): boolean {
  if (!b) return true;
  return a.overallScore > b.overallScore;
}

// ============================================================================
// Topic Selection
// ============================================================================

async function getRecentPollTopics(days: number = RECENT_TOPICS_DAYS): Promise<string[]> {
  try {
    const result = await query<{ question: string }>(
      `SELECT question FROM polls 
       WHERE created_at > NOW() - INTERVAL '${days} days'
       ORDER BY created_at DESC`
    );
    return result.rows.map(r => r.question.toLowerCase());
  } catch (error) {
    console.error('[GENERATOR] Error fetching recent topics:', error);
    return [];
  }
}

/**
 * Checks if a topic cluster is too similar to recently published polls.
 * 
 * Generic political terms (president, house, congress, etc.) are NEVER considered
 * "too similar" on their own because:
 * 1. They appear in nearly every political poll question
 * 2. A single keyword can't distinguish between different stories (e.g., "house"
 *    could mean a new vote, an investigation, a leadership change, etc.)
 * 3. The LLM generates polls from specific articles, so even with the same topic
 *    keyword, different days will produce different questions about different events
 * 
 * True duplicate prevention happens at the poll question level via the evergreen
 * exclusion window and question-matching logic.
 * 
 * For specific multi-word or uncommon topics (e.g., "tariff", "impeachment trial"):
 * Use stricter matching since these indicate more specific stories.
 */
export function isTopicTooSimilarToRecent(topic: string, recentTopics: string[]): boolean {
  const topicLower = topic.toLowerCase().trim();
  
  if (!topicLower || recentTopics.length === 0) {
    return false;
  }
  
  // Generic political terms are too broad to indicate "same story" - skip them entirely.
  // A cluster with topic "president" about a trade announcement is different from
  // a recent poll about the president's healthcare stance, even though both mention
  // "president". Let the LLM's article-based generation produce distinct questions.
  if (GENERIC_POLITICAL_TERMS.has(topicLower)) {
    return false;
  }
  
  // For specific (non-generic) terms, use stricter matching to catch actual
  // topic overlap (e.g., back-to-back polls about "tariffs" or "student loans")
  for (const recent of recentTopics) {
    const recentLower = recent.toLowerCase();
    
    // Similar if the specific topic appears as a word/phrase in the recent question
    // Use word boundary matching to avoid false positives (e.g., "tax" matching "taxation")
    const wordBoundaryPattern = new RegExp(`\\b${escapeRegex(topicLower)}\\b`);
    if (wordBoundaryPattern.test(recentLower)) {
      return true;
    }
    
    // Check if topic is a multi-word phrase that appears in the question
    // (handles cases like topic "student loan" matching "student loan forgiveness debate")
    if (topicLower.includes(' ') && recentLower.includes(topicLower)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Escapes special regex characters in a string for safe use in RegExp constructor.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TopicCandidate {
  topic: TopicCluster;
  reason: string;
}

/**
 * Selects all suitable topic candidates from clusters, ordered by score.
 * Each candidate passes the minimum requirements for poll generation.
 */
function selectCandidateTopics(
  clusters: TopicCluster[],
  recentTopics: string[],
  maxCandidates: number = MAX_TOPICS_TO_TRY
): TopicCandidate[] {
  const candidates: TopicCandidate[] = [];
  
  for (const cluster of clusters) {
    if (candidates.length >= maxCandidates) break;
    
    if (cluster.articles.length < MIN_ARTICLES_PER_TOPIC) {
      continue;
    }
    
    if (isTopicTooSimilarToRecent(cluster.topic, recentTopics)) {
      console.log(`[GENERATOR] Skipping "${cluster.topic}" - too similar to recent poll`);
      continue;
    }
    
    if (cluster.coverageBreadth < 2) {
      console.log(`[GENERATOR] Skipping "${cluster.topic}" - insufficient coverage breadth`);
      continue;
    }
    
    const reason = `Selected "${cluster.topic}" with ${cluster.articles.length} articles from ${cluster.coverageBreadth} political perspectives. Prominence: ${cluster.prominenceScore}, Debatability: ${cluster.debatabilityScore}`;
    
    candidates.push({ topic: cluster, reason });
  }
  
  return candidates;
}

async function selectBestTopic(
  clusters: TopicCluster[],
  recentTopics: string[]
): Promise<{ topic: TopicCluster; reason: string } | null> {
  const candidates = selectCandidateTopics(clusters, recentTopics, 1);
  return candidates.length > 0 ? candidates[0] : null;
}

// ============================================================================
// Fallback Handling
// ============================================================================

const EVERGREEN_EXCLUSION_DAYS = 14;

async function getEvergreenFallback(): Promise<EvergreenPoll | null> {
  try {
    // First, get recent poll questions to exclude from evergreen selection
    // This prevents the same question from appearing within the exclusion window
    const recentPollsResult = await query<{ question: string }>(
      `SELECT question FROM polls 
       WHERE created_at > NOW() - INTERVAL '${EVERGREEN_EXCLUSION_DAYS} days'
       ORDER BY created_at DESC`
    );
    
    const recentQuestions = recentPollsResult.rows.map(r => r.question.toLowerCase().trim());
    console.log(`[GENERATOR] Found ${recentQuestions.length} recent poll questions to exclude from evergreen selection`);
    
    // Fetch all active evergreen polls, ordered by least recently used
    const evergreenResult = await query<EvergreenPoll>(
      `SELECT * FROM evergreen_polls 
       WHERE is_active = TRUE 
       ORDER BY last_used_at ASC NULLS FIRST, use_count ASC`
    );
    
    if (evergreenResult.rows.length === 0) {
      console.warn('[GENERATOR] No active evergreen polls available');
      return null;
    }
    
    console.log(`[GENERATOR] Evaluating ${evergreenResult.rows.length} evergreen polls`);
    
    // Find the first evergreen poll whose question wasn't used recently
    let selectedPoll: EvergreenPoll | null = null;
    
    for (const poll of evergreenResult.rows) {
      const pollQuestionLower = poll.question.toLowerCase().trim();
      
      // Check if this exact question (or very similar) was used recently
      const wasUsedRecently = recentQuestions.some(recentQ => {
        // Exact match
        if (recentQ === pollQuestionLower) return true;
        
        // Check for high similarity (one contains the other, ignoring minor differences)
        // This catches cases like "Should X?" vs "Should X" (with/without question mark)
        const normalizedRecent = recentQ.replace(/[?!.,]/g, '').trim();
        const normalizedPoll = pollQuestionLower.replace(/[?!.,]/g, '').trim();
        
        if (normalizedRecent === normalizedPoll) return true;
        
        // Check if the core question is the same (first 50 chars match)
        if (normalizedRecent.slice(0, 50) === normalizedPoll.slice(0, 50)) return true;
        
        return false;
      });
      
      if (wasUsedRecently) {
        console.log(`[GENERATOR] Skipping evergreen "${poll.question.slice(0, 50)}..." - used recently`);
        continue;
      }
      
      selectedPoll = poll;
      console.log(`[GENERATOR] Selected evergreen: "${poll.question.slice(0, 50)}..."`);
      break;
    }
    
    // If all evergreen polls were used recently, fall back to the least recently used one
    // This is a last resort when the pool is exhausted
    if (!selectedPoll) {
      console.warn('[GENERATOR] All evergreen polls were used recently, using least recently used as fallback');
      selectedPoll = evergreenResult.rows[0];
    }
    
    // Update the selected poll's usage tracking
    await query(
      `UPDATE evergreen_polls 
       SET last_used_at = NOW(), use_count = use_count + 1 
       WHERE id = $1`,
      [selectedPoll.id]
    );
    
    return selectedPoll;
  } catch (error) {
    console.error('[GENERATOR] Error fetching evergreen fallback:', error);
    return null;
  }
}

function evergreenToGeneratedPoll(evergreen: EvergreenPoll): GeneratedPoll {
  const options = JSON.parse(evergreen.options_json) as Array<{ text: string }>;
  
  return {
    question: evergreen.question,
    options,
    briefing: {
      background: evergreen.briefing_background || '',
      conservative: evergreen.briefing_conservative || '',
      liberal: evergreen.briefing_liberal || '',
      centrist: evergreen.briefing_centrist || '',
    },
    sources: [],
    topicSummary: `Evergreen fallback poll from category: ${evergreen.category || 'general'}`,
  };
}

// ============================================================================
// Database Operations
// ============================================================================

async function createGenerationRun(runDate: Date): Promise<string> {
  const id = generateId();
  
  await query(
    `INSERT INTO generation_runs (id, run_date, status, started_at)
     VALUES ($1, $2, 'pending', NOW())`,
    [id, runDate]
  );
  
  return id;
}

async function updateGenerationRun(
  runId: string,
  updates: Partial<GenerationRun>
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  const fieldMap: Record<string, string> = {
    status: 'status',
    selected_topic: 'selected_topic',
    topic_reason: 'topic_reason',
    candidate_topics_json: 'candidate_topics_json',
    recent_topics_avoided: 'recent_topics_avoided',
    news_sources_queried: 'news_sources_queried',
    articles_fetched_count: 'articles_fetched_count',
    articles_used_count: 'articles_used_count',
    generated_poll_id: 'generated_poll_id',
    model_used: 'model_used',
    generation_prompt_hash: 'generation_prompt_hash',
    bias_score: 'bias_score',
    balance_score: 'balance_score',
    citation_validity_score: 'citation_validity_score',
    retry_count: 'retry_count',
    used_fallback: 'used_fallback',
    fallback_reason: 'fallback_reason',
    error_message: 'error_message',
    raw_llm_input: 'raw_llm_input',
    raw_llm_output: 'raw_llm_output',
    bias_check_output: 'bias_check_output',
    completed_at: 'completed_at',
  };
  
  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (dbField && value !== undefined) {
      setClauses.push(`${dbField} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (setClauses.length === 0) return;
  
  values.push(runId);
  
  await query(
    `UPDATE generation_runs SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

async function saveFetchedArticles(
  runId: string,
  articles: NewsArticle[],
  topicCluster?: string
): Promise<void> {
  if (articles.length === 0) return;
  
  // Batch insert for performance - converts 150 sequential queries into 1
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    
    batch.forEach((article, idx) => {
      const offset = idx * 10;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`
      );
      values.push(
        generateId(),
        runId,
        article.source.name,
        article.url,
        article.title,
        article.description,
        article.content,
        article.publishedAt,
        article.source.politicalLean,
        topicCluster || null
      );
    });
    
    await query(
      `INSERT INTO fetched_articles 
       (id, generation_run_id, source_name, source_url, article_title, article_description, article_content, published_at, political_lean, topic_cluster)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  }
  
  console.log(`[GENERATOR] Batch-inserted ${articles.length} articles`);
}

async function createPollFromGenerated(
  generatedPoll: GeneratedPoll,
  runId: string,
  isAutoGenerated: boolean = true
): Promise<string> {
  const pollId = generateId();
  const now = new Date();
  
  await query(
    `INSERT INTO polls 
     (id, question, status, briefing_background, briefing_conservative, briefing_liberal, briefing_centrist, generation_run_id, is_auto_generated, created_at, updated_at)
     VALUES ($1, $2, 'scheduled', $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      pollId,
      generatedPoll.question,
      generatedPoll.briefing.background,
      generatedPoll.briefing.conservative,
      generatedPoll.briefing.liberal,
      generatedPoll.briefing.centrist,
      runId,
      isAutoGenerated,
      now,
    ]
  );
  
  for (let i = 0; i < generatedPoll.options.length; i++) {
    const optionId = generateId();
    await query(
      `INSERT INTO poll_options (id, poll_id, option_text, display_order, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [optionId, pollId, generatedPoll.options[i].text, i + 1, now]
    );
  }
  
  for (const source of generatedPoll.sources) {
    const sourceId = generateId();
    await query(
      `INSERT INTO poll_sources 
       (id, poll_id, source_name, source_url, article_title, article_snippet, political_lean, perspective_used, fetched_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sourceId,
        pollId,
        source.sourceName,
        source.sourceUrl,
        source.articleTitle,
        source.snippet,
        source.politicalLean,
        source.usedForPerspective,
        now,
        now,
      ]
    );
  }
  
  return pollId;
}

// ============================================================================
// Main Generation Pipeline
// ============================================================================

function checkTimeout(startTime: number, phase: string): void {
  const elapsed = Date.now() - startTime;
  const limit = getGenerationTimeoutMs();
  const remaining = limit - elapsed;
  
  if (remaining <= MIN_TIME_FOR_FALLBACK_MS) {
    throw new Error(`Generation timeout in ${phase}: ${elapsed}ms elapsed (limit: ${limit}ms, need ${MIN_TIME_FOR_FALLBACK_MS}ms for fallback)`);
  }
  console.log(`[GENERATOR] ${phase} - ${elapsed}ms elapsed, ${remaining}ms remaining`);
}

export async function runPollGeneration(): Promise<GenerationResult> {
  const runDate = new Date();
  const startTime = Date.now();
  const runId = await createGenerationRun(runDate);
  
  console.log(`[GENERATOR] Starting generation run ${runId} for ${runDate.toISOString()}`);
  console.log(`[GENERATOR] Timeout limit: ${getGenerationTimeoutMs()}ms`);
  console.log(`[GENERATOR] Multi-topic fallback enabled: up to ${MAX_TOPICS_TO_TRY} topics, near-pass threshold: ${NEAR_PASS_OVERALL_THRESHOLD}`);
  
  let totalRetryCount = 0;
  let lastError: string | undefined;
  let bestNearPassDraft: NearPassDraft | null = null;
  const topicsAttempted: string[] = [];
  
  try {
    await updateGenerationRun(runId, { status: 'fetching_news' as const });
    
    console.log('[GENERATOR] Fetching news articles...');
    const articles = await fetchNews({ maxArticles: MAX_ARTICLES_FOR_SPEED });
    
    checkTimeout(startTime, 'after news fetch');
    
    if (articles.length === 0) {
      console.error('[GENERATOR] News fetch returned 0 articles - this will trigger evergreen fallback');
      throw new Error('No news articles fetched - RSS feeds may be down or returning old content');
    }
    
    console.log(`[GENERATOR] Successfully fetched ${articles.length} news articles`);
    
    const sourceCounts = articles.reduce((acc, a) => {
      acc[a.source.politicalLean] = (acc[a.source.politicalLean] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[GENERATOR] Article distribution by political lean:', JSON.stringify(sourceCounts));
    
    await updateGenerationRun(runId, {
      articles_fetched_count: articles.length,
      news_sources_queried: 'NewsAPI,RSS',
    });
    
    await saveFetchedArticles(runId, articles);
    
    checkTimeout(startTime, 'after article save');
    
    await updateGenerationRun(runId, { status: 'selecting_topic' as const });
    
    const clusters = clusterArticlesByTopic(articles);
    const recentTopics = await getRecentPollTopics();
    
    await updateGenerationRun(runId, {
      candidate_topics_json: JSON.stringify(clusters.slice(0, 10).map(c => ({
        topic: c.topic,
        articleCount: c.articles.length,
        prominence: c.prominenceScore,
        breadth: c.coverageBreadth,
      }))),
      recent_topics_avoided: recentTopics.slice(0, 5).join('; '),
    });
    
    const candidateTopics = selectCandidateTopics(clusters, recentTopics, MAX_TOPICS_TO_TRY);
    
    if (candidateTopics.length === 0) {
      console.error('[GENERATOR] No suitable topics found from clusters');
      console.error(`[GENERATOR] Cluster count: ${clusters.length}`);
      console.error(`[GENERATOR] Recent topics to avoid: ${recentTopics.length}`);
      if (clusters.length > 0) {
        console.error('[GENERATOR] Top clusters evaluated:', clusters.slice(0, 5).map(c => ({
          topic: c.topic,
          articles: c.articles.length,
          breadth: c.coverageBreadth,
        })));
      }
      throw new Error(`No suitable topic found - ${clusters.length} clusters evaluated, ${recentTopics.length} recent topics excluded`);
    }
    
    console.log(`[GENERATOR] Found ${candidateTopics.length} candidate topics: ${candidateTopics.map(c => c.topic.topic).join(', ')}`);
    
    const llmTimeout = getLlmTimeoutMs();
    console.log(`[GENERATOR] Starting LLM generation with timeout=${llmTimeout}ms, pipeline limit=${getGenerationTimeoutMs()}ms`);
    
    // Try each candidate topic until one passes or we exhaust all options
    for (let topicIndex = 0; topicIndex < candidateTopics.length; topicIndex++) {
      const { topic: selectedCluster, reason: topicReason } = candidateTopics[topicIndex];
      
      if (!hasTimeForLlmRetry(startTime)) {
        const remaining = getTimeRemainingMs(startTime);
        console.log(`[GENERATOR] Only ${remaining}ms remaining (need ${MIN_TIME_FOR_LLM_RETRY_MS}ms), stopping topic iteration`);
        lastError = `Insufficient time to try topic ${topicIndex + 1} (${remaining}ms remaining)`;
        break;
      }
      
      topicsAttempted.push(selectedCluster.topic);
      console.log(`[GENERATOR] Trying topic ${topicIndex + 1}/${candidateTopics.length}: "${selectedCluster.topic}"`);
      
      await updateGenerationRun(runId, {
        selected_topic: selectedCluster.topic,
        topic_reason: topicReason,
      });
      
      const topicArticles = await fetchArticlesForTopic(
        selectedCluster.topic,
        articles,
        12
      );
      
      await updateGenerationRun(runId, {
        articles_used_count: topicArticles.length,
      });
      
      checkTimeout(startTime, `before LLM generation for topic ${topicIndex + 1}`);
      
      let topicRetryCount = 0;
      let topicPassed = false;
      
      while (topicRetryCount < MAX_RETRIES) {
        if (!hasTimeForLlmRetry(startTime)) {
          const remaining = getTimeRemainingMs(startTime);
          console.log(`[GENERATOR] Only ${remaining}ms remaining (need ${MIN_TIME_FOR_LLM_RETRY_MS}ms), stopping retries for topic "${selectedCluster.topic}"`);
          lastError = `Insufficient time for retry after ${topicRetryCount} attempts on topic "${selectedCluster.topic}" (${remaining}ms remaining)`;
          break;
        }
        
        try {
          await updateGenerationRun(runId, { 
            status: 'generating' as const,
            retry_count: totalRetryCount,
          });
          
          console.log(`[GENERATOR] Topic "${selectedCluster.topic}" attempt ${topicRetryCount + 1}/${MAX_RETRIES}, ${getTimeRemainingMs(startTime)}ms remaining`);
          
          const { poll: generatedPoll, promptHash, rawInput, rawOutput } = await generatePoll(
            selectedCluster.topic,
            topicArticles
          );
          
          checkTimeout(startTime, 'after poll generation');
          
          await updateGenerationRun(runId, {
            model_used: getModelId(),
            generation_prompt_hash: promptHash,
            raw_llm_input: rawInput,
            raw_llm_output: rawOutput,
          });
          
          await updateGenerationRun(runId, { status: 'validating' as const });
          
          const citationResult = validateCitations(generatedPoll, topicArticles);
          
          await updateGenerationRun(runId, {
            citation_validity_score: citationResult.score,
          });
          
          if (!citationResult.valid) {
            console.warn(`[GENERATOR] Invalid citations: ${citationResult.invalidSources.join(', ')}`);
            if (citationResult.score < 0.5) {
              throw new Error(`Citation validation failed: ${citationResult.invalidSources.length} invalid sources`);
            }
          }
          
          const biasResult = await checkPollBias(generatedPoll);
          
          checkTimeout(startTime, 'after bias check');
          
          await updateGenerationRun(runId, {
            bias_score: biasResult.questionBiasScore,
            balance_score: biasResult.overallScore,
            bias_check_output: JSON.stringify(biasResult),
          });
          
          if (biasResult.passesThreshold) {
            const pollId = await createPollFromGenerated(generatedPoll, runId, true);
            
            const successReason = topicsAttempted.length > 1
              ? `Successfully generated poll on topic ${topicsAttempted.length} ("${selectedCluster.topic}") after topics [${topicsAttempted.slice(0, -1).join(', ')}] failed bias checks.`
              : undefined;
            
            await updateGenerationRun(runId, {
              status: 'success' as const,
              generated_poll_id: pollId,
              completed_at: new Date(),
              fallback_reason: successReason,
            });
            
            console.log(`[GENERATOR] Successfully generated poll ${pollId} for topic "${selectedCluster.topic}"`);
            if (topicsAttempted.length > 1) {
              console.log(`[GENERATOR] Note: This was topic ${topicsAttempted.length} after earlier topics failed bias checks`);
            }
            
            return {
              success: true,
              poll: generatedPoll,
              biasCheck: biasResult,
              runId,
            };
          }
          
          // Bias check failed - check if this is a near-pass
          console.log(`[GENERATOR] Bias check failed for topic "${selectedCluster.topic}": ${biasResult.issues.join(', ')}`);
          console.log(`[GENERATOR] Scores: overall=${biasResult.overallScore.toFixed(2)}, question=${biasResult.questionBiasScore.toFixed(2)}, options=${biasResult.optionBalanceScore.toFixed(2)}, perspectives=${biasResult.perspectiveBalanceScore.toFixed(2)}`);
          
          if (isNearPass(biasResult) && isBetterBiasResult(biasResult, bestNearPassDraft?.biasResult || null)) {
            console.log(`[GENERATOR] Recording as best near-pass draft (overall score: ${biasResult.overallScore.toFixed(2)})`);
            bestNearPassDraft = {
              poll: generatedPoll,
              biasResult,
              topic: selectedCluster.topic,
              promptHash,
              rawInput,
              rawOutput,
            };
          }
          
          lastError = `Bias check failed: ${biasResult.issues.join(', ')}`;
          topicRetryCount++;
          totalRetryCount++;
          
          await updateGenerationRun(runId, {
            retry_count: totalRetryCount,
            error_message: lastError,
          });
          
          if (topicRetryCount >= MAX_RETRIES) {
            console.log(`[GENERATOR] Max retries (${MAX_RETRIES}) reached for topic "${selectedCluster.topic}"`);
            break;
          }
          
        } catch (error) {
          topicRetryCount++;
          totalRetryCount++;
          const isTimeout = error instanceof LlmTimeoutError;
          const isEmptyResponse = error instanceof EmptyLlmResponseError;
          const isJsonError = error instanceof JsonExtractionError;
          const isRetryable = isEmptyResponse || isJsonError;
          lastError = error instanceof Error ? error.message : String(error);
          
          if (isTimeout) {
            console.error(`[GENERATOR] LLM timeout on topic "${selectedCluster.topic}" attempt ${topicRetryCount}:`, lastError);
          } else if (isEmptyResponse) {
            console.error(`[GENERATOR] Empty LLM response on topic "${selectedCluster.topic}" attempt ${topicRetryCount}`);
          } else if (isJsonError) {
            console.error(`[GENERATOR] JSON extraction failed on topic "${selectedCluster.topic}" attempt ${topicRetryCount}:`, lastError);
            if (error instanceof JsonExtractionError) {
              console.error(`[GENERATOR] Raw response preview:`, error.rawResponse);
            }
          } else {
            console.error(`[GENERATOR] Topic "${selectedCluster.topic}" attempt ${topicRetryCount} failed:`, lastError);
          }
          
          await updateGenerationRun(runId, {
            retry_count: totalRetryCount,
            error_message: lastError,
          });
          
          if (topicRetryCount >= MAX_RETRIES) {
            console.log(`[GENERATOR] Max retries (${MAX_RETRIES}) reached for topic "${selectedCluster.topic}"`);
            break;
          }
          
          if (isTimeout) {
            if (hasTimeForLlmRetry(startTime)) {
              console.log(`[GENERATOR] LLM timed out but time remains (${getTimeRemainingMs(startTime)}ms), will retry`);
              continue;
            }
            console.log('[GENERATOR] LLM timed out and insufficient time for retry');
            break;
          }
          
          if (isRetryable && hasTimeForLlmRetry(startTime)) {
            console.log(`[GENERATOR] Retrying after recoverable error (${getTimeRemainingMs(startTime)}ms remaining)`);
            continue;
          }
        }
      }
      
      if (topicPassed) break;
      
      // Topic exhausted its retries, try next topic
      if (topicIndex < candidateTopics.length - 1) {
        console.log(`[GENERATOR] Topic "${selectedCluster.topic}" exhausted retries, moving to next candidate topic`);
      }
    }
    
    // All topics exhausted - check if we have a near-pass draft
    if (bestNearPassDraft) {
      console.log(`[GENERATOR] No topic passed cleanly, but found a near-pass draft from topic "${bestNearPassDraft.topic}"`);
      console.log(`[GENERATOR] Near-pass scores: overall=${bestNearPassDraft.biasResult.overallScore.toFixed(2)}, question=${bestNearPassDraft.biasResult.questionBiasScore.toFixed(2)}, options=${bestNearPassDraft.biasResult.optionBalanceScore.toFixed(2)}, perspectives=${bestNearPassDraft.biasResult.perspectiveBalanceScore.toFixed(2)}`);
      
      const pollId = await createPollFromGenerated(bestNearPassDraft.poll, runId, true);
      
      const nearPassReason = `All ${topicsAttempted.length} topic(s) [${topicsAttempted.join(', ')}] failed full bias check. Published near-pass draft from topic "${bestNearPassDraft.topic}" with overall score ${bestNearPassDraft.biasResult.overallScore.toFixed(2)} (threshold: 0.7, near-pass threshold: ${NEAR_PASS_OVERALL_THRESHOLD}). Issues: ${bestNearPassDraft.biasResult.issues.join('; ') || 'none flagged'}.`;
      
      await updateGenerationRun(runId, {
        status: 'success' as const,
        generated_poll_id: pollId,
        selected_topic: bestNearPassDraft.topic,
        bias_score: bestNearPassDraft.biasResult.questionBiasScore,
        balance_score: bestNearPassDraft.biasResult.overallScore,
        bias_check_output: JSON.stringify(bestNearPassDraft.biasResult),
        generation_prompt_hash: bestNearPassDraft.promptHash,
        raw_llm_input: bestNearPassDraft.rawInput,
        raw_llm_output: bestNearPassDraft.rawOutput,
        used_fallback: true,
        fallback_reason: nearPassReason,
        completed_at: new Date(),
      });
      
      console.log(`[GENERATOR] Published near-pass poll ${pollId} from topic "${bestNearPassDraft.topic}"`);
      
      return {
        success: true,
        poll: bestNearPassDraft.poll,
        biasCheck: bestNearPassDraft.biasResult,
        runId,
        usedFallback: true,
      };
    }
    
    // No near-pass available - fall back to evergreen
    const fallbackReasonPrefix = `All ${topicsAttempted.length} topic(s) [${topicsAttempted.join(', ')}] failed bias checks with no near-pass candidates (scores below ${NEAR_PASS_OVERALL_THRESHOLD})`;
    console.log(`[GENERATOR] ${fallbackReasonPrefix}, using evergreen fallback`);
    console.log(`[GENERATOR] Last error: ${lastError}`);
    
    const evergreen = await getEvergreenFallback();
    
    if (evergreen) {
      const fallbackPoll = evergreenToGeneratedPoll(evergreen);
      const pollId = await createPollFromGenerated(fallbackPoll, runId, false);
      
      await updateGenerationRun(runId, {
        status: 'fallback' as const,
        generated_poll_id: pollId,
        used_fallback: true,
        fallback_reason: `${fallbackReasonPrefix}. Last error: ${lastError}. Using evergreen poll.`,
        completed_at: new Date(),
      });
      
      console.log(`[GENERATOR] Used evergreen fallback poll ${pollId}`);
      
      return {
        success: true,
        poll: fallbackPoll,
        runId,
        usedFallback: true,
      };
    }
    
    await updateGenerationRun(runId, {
      status: 'failed' as const,
      error_message: `All topics failed and no fallback available: ${lastError}`,
      completed_at: new Date(),
    });
    
    return {
      success: false,
      runId,
      error: `Generation failed: ${lastError}`,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout');
    
    console.error('[GENERATOR] Generation error:', errorMessage);
    
    // On timeout or critical errors, check for near-pass first, then try evergreen
    if (isTimeout || errorMessage.includes('No news articles') || errorMessage.includes('No suitable topic')) {
      // If we have a near-pass draft from before the error, use it
      if (bestNearPassDraft) {
        console.log(`[GENERATOR] Error occurred but have near-pass draft from topic "${bestNearPassDraft.topic}", using it`);
        
        const pollId = await createPollFromGenerated(bestNearPassDraft.poll, runId, true);
        
        const nearPassReason = `Error during generation: ${errorMessage}. Published near-pass draft from topic "${bestNearPassDraft.topic}" with overall score ${bestNearPassDraft.biasResult.overallScore.toFixed(2)}.`;
        
        await updateGenerationRun(runId, {
          status: 'success' as const,
          generated_poll_id: pollId,
          selected_topic: bestNearPassDraft.topic,
          bias_score: bestNearPassDraft.biasResult.questionBiasScore,
          balance_score: bestNearPassDraft.biasResult.overallScore,
          bias_check_output: JSON.stringify(bestNearPassDraft.biasResult),
          used_fallback: true,
          fallback_reason: nearPassReason,
          completed_at: new Date(),
        });
        
        console.log(`[GENERATOR] Published near-pass poll ${pollId} after error`);
        
        return {
          success: true,
          poll: bestNearPassDraft.poll,
          biasCheck: bestNearPassDraft.biasResult,
          runId,
          usedFallback: true,
        };
      }
      
      console.log('[GENERATOR] Attempting evergreen fallback after error...');
      
      const evergreen = await getEvergreenFallback();
      
      if (evergreen) {
        const fallbackPoll = evergreenToGeneratedPoll(evergreen);
        const pollId = await createPollFromGenerated(fallbackPoll, runId, false);
        
        await updateGenerationRun(runId, {
          status: 'fallback' as const,
          generated_poll_id: pollId,
          used_fallback: true,
          fallback_reason: `Error during generation: ${errorMessage}. Using evergreen poll.`,
          completed_at: new Date(),
        });
        
        console.log(`[GENERATOR] Used fallback poll ${pollId} after error`);
        
        return {
          success: true,
          poll: fallbackPoll,
          runId,
          usedFallback: true,
        };
      }
    }
    
    await updateGenerationRun(runId, {
      status: 'failed' as const,
      error_message: errorMessage,
      completed_at: new Date(),
    });
    
    return {
      success: false,
      runId,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Scheduled Job Entry Point
// ============================================================================

export async function runScheduledGeneration(): Promise<GenerationResult> {
  console.log('[GENERATOR] Running scheduled poll generation...');
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const existingRun = await query<{ id: string; status: string }>(
    `SELECT id, status FROM generation_runs 
     WHERE run_date = $1 AND status IN ('success', 'fallback')
     ORDER BY created_at DESC LIMIT 1`,
    [todayStart]
  );
  
  if (existingRun.rows.length > 0) {
    console.log(`[GENERATOR] Poll already generated today (run ${existingRun.rows[0].id})`);
    return {
      success: true,
      runId: existingRun.rows[0].id,
    };
  }
  
  return runPollGeneration();
}
