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
} from '@/types';

// ============================================================================
// Configuration
// ============================================================================

const MAX_RETRIES = 3;
const MIN_ARTICLES_PER_TOPIC = 4;
const RECENT_TOPICS_DAYS = 7;

const MAX_ARTICLES_FOR_SPEED = 50;

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

function isTopicTooSimilarToRecent(topic: string, recentTopics: string[]): boolean {
  const topicLower = topic.toLowerCase();
  
  for (const recent of recentTopics) {
    if (recent.includes(topicLower) || topicLower.includes(recent.split(' ').slice(0, 3).join(' '))) {
      return true;
    }
  }
  
  return false;
}

async function selectBestTopic(
  clusters: TopicCluster[],
  recentTopics: string[]
): Promise<{ topic: TopicCluster; reason: string } | null> {
  for (const cluster of clusters) {
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
    
    return { topic: cluster, reason };
  }
  
  return null;
}

// ============================================================================
// Fallback Handling
// ============================================================================

async function getEvergreenFallback(): Promise<EvergreenPoll | null> {
  try {
    const result = await query<EvergreenPoll>(
      `SELECT * FROM evergreen_polls 
       WHERE is_active = TRUE 
       ORDER BY last_used_at ASC NULLS FIRST, use_count ASC 
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const poll = result.rows[0];
    
    await query(
      `UPDATE evergreen_polls 
       SET last_used_at = NOW(), use_count = use_count + 1 
       WHERE id = $1`,
      [poll.id]
    );
    
    return poll;
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
  
  let retryCount = 0;
  let lastError: string | undefined;
  
  try {
    await updateGenerationRun(runId, { status: 'fetching_news' as const });
    
    // Fetch fewer articles for speed - we only need enough for topic clustering and LLM context
    const articles = await fetchNews({ maxArticles: MAX_ARTICLES_FOR_SPEED });
    
    checkTimeout(startTime, 'after news fetch');
    
    if (articles.length === 0) {
      throw new Error('No news articles fetched');
    }
    
    await updateGenerationRun(runId, {
      articles_fetched_count: articles.length,
      news_sources_queried: 'NewsAPI,RSS',
    });
    
    // Save articles in batches for audit trail (non-blocking if we timeout later)
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
    
    const topicSelection = await selectBestTopic(clusters, recentTopics);
    
    if (!topicSelection) {
      throw new Error('No suitable topic found');
    }
    
    const { topic: selectedCluster, reason: topicReason } = topicSelection;
    
    console.log(`[GENERATOR] Selected topic: ${selectedCluster.topic}`);
    
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
    
checkTimeout(startTime, 'before LLM generation');
    
    let llmTimedOut = false;
    const llmTimeout = getLlmTimeoutMs();
    
    console.log(`[GENERATOR] Starting LLM generation with timeout=${llmTimeout}ms, pipeline limit=${getGenerationTimeoutMs()}ms`);
    
    while (retryCount < MAX_RETRIES) {
      if (!hasTimeForLlmRetry(startTime)) {
        const remaining = getTimeRemainingMs(startTime);
        console.log(`[GENERATOR] Only ${remaining}ms remaining (need ${MIN_TIME_FOR_LLM_RETRY_MS}ms), bailing to fallback`);
        lastError = `Insufficient time for retry after ${retryCount} attempts (${remaining}ms remaining)`;
        break;
      }
      
      try {
        await updateGenerationRun(runId, { 
          status: 'generating' as const,
          retry_count: retryCount,
        });
        
        console.log(`[GENERATOR] Attempt ${retryCount + 1}/${MAX_RETRIES}, ${getTimeRemainingMs(startTime)}ms remaining`);
        
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
        
        if (!biasResult.passesThreshold) {
          throw new Error(`Bias check failed: ${biasResult.issues.join(', ')}`);
        }
        
        const pollId = await createPollFromGenerated(generatedPoll, runId, true);
        
        await updateGenerationRun(runId, {
          status: 'success' as const,
          generated_poll_id: pollId,
          completed_at: new Date(),
        });
        
        console.log(`[GENERATOR] Successfully generated poll ${pollId}`);
        
        return {
          success: true,
          poll: generatedPoll,
          biasCheck: biasResult,
          runId,
        };
        
      } catch (error) {
        retryCount++;
        const isTimeout = error instanceof LlmTimeoutError;
        const isEmptyResponse = error instanceof EmptyLlmResponseError;
        const isJsonError = error instanceof JsonExtractionError;
        const isRetryable = isEmptyResponse || isJsonError;
        lastError = error instanceof Error ? error.message : String(error);
        
        if (isTimeout) {
          llmTimedOut = true;
          console.error(`[GENERATOR] LLM timeout on attempt ${retryCount}:`, lastError);
        } else if (isEmptyResponse) {
          console.error(`[GENERATOR] Empty LLM response on attempt ${retryCount}`);
        } else if (isJsonError) {
          console.error(`[GENERATOR] JSON extraction failed on attempt ${retryCount}:`, lastError);
          if (error instanceof JsonExtractionError) {
            console.error(`[GENERATOR] Raw response preview:`, error.rawResponse);
          }
        } else {
          console.error(`[GENERATOR] Attempt ${retryCount} failed:`, lastError);
        }
        
        await updateGenerationRun(runId, {
          retry_count: retryCount,
          error_message: lastError,
        });
        
        if (retryCount >= MAX_RETRIES) {
          console.log(`[GENERATOR] Max retries (${MAX_RETRIES}) reached`);
          break;
        }
        
        if (isTimeout) {
          if (hasTimeForLlmRetry(startTime)) {
            console.log(`[GENERATOR] LLM timed out but time remains (${getTimeRemainingMs(startTime)}ms), will retry`);
            continue;
          }
          console.log('[GENERATOR] LLM timed out and insufficient time for retry, falling through to evergreen');
          break;
        }
        
        if (isRetryable && hasTimeForLlmRetry(startTime)) {
          console.log(`[GENERATOR] Retrying after recoverable error (${getTimeRemainingMs(startTime)}ms remaining)`);
          continue;
        }
      }
    }
    
    const fallbackReasonPrefix = llmTimedOut 
      ? 'LLM call timed out' 
      : `Generation failed after ${retryCount} attempts`;
    console.log(`[GENERATOR] ${fallbackReasonPrefix}, using evergreen fallback`);
    
    const evergreen = await getEvergreenFallback();
    
    if (evergreen) {
      const fallbackPoll = evergreenToGeneratedPoll(evergreen);
      const pollId = await createPollFromGenerated(fallbackPoll, runId, false);
      
      await updateGenerationRun(runId, {
        status: 'fallback' as const,
        generated_poll_id: pollId,
        used_fallback: true,
        fallback_reason: `${fallbackReasonPrefix}: ${lastError}. Using evergreen poll.`,
        completed_at: new Date(),
      });
      
      console.log(`[GENERATOR] Used fallback poll ${pollId}`);
      
      return {
        success: true,
        poll: fallbackPoll,
        runId,
        usedFallback: true,
      };
    }
    
    await updateGenerationRun(runId, {
      status: 'failed' as const,
      error_message: `All attempts failed and no fallback available: ${lastError}`,
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
    
    // On timeout or critical errors, try evergreen fallback before giving up
    if (isTimeout || errorMessage.includes('No news articles') || errorMessage.includes('No suitable topic')) {
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
