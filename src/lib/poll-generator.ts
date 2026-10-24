import { query, transaction } from './db';
import { fetchNews, clusterArticlesByTopic, fetchArticlesForTopic } from './news';
import { generatePoll, checkPollBias, validateCitations, getModelId } from './xai';
import { generateId } from './ulid';
import {
  GenerationRun,
  GenerationResult,
  TopicCluster,
  NewsArticle,
  GeneratedPoll,
  EvergreenPoll,
  PoliticalLean,
} from '@/types';

// ============================================================================
// Configuration
// ============================================================================

const MAX_RETRIES = 3;
const MIN_ARTICLES_PER_TOPIC = 4;
const RECENT_TOPICS_DAYS = 7;

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
  for (const article of articles) {
    const id = generateId();
    
    await query(
      `INSERT INTO fetched_articles 
       (id, generation_run_id, source_name, source_url, article_title, article_description, article_content, published_at, political_lean, topic_cluster)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        runId,
        article.source.name,
        article.url,
        article.title,
        article.description,
        article.content,
        article.publishedAt,
        article.source.politicalLean,
        topicCluster || null,
      ]
    );
  }
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

export async function runPollGeneration(): Promise<GenerationResult> {
  const runDate = new Date();
  const runId = await createGenerationRun(runDate);
  
  console.log(`[GENERATOR] Starting generation run ${runId} for ${runDate.toISOString()}`);
  
  let retryCount = 0;
  let lastError: string | undefined;
  
  try {
    await updateGenerationRun(runId, { status: 'fetching_news' as const });
    
    const articles = await fetchNews({ maxArticles: 150 });
    
    if (articles.length === 0) {
      throw new Error('No news articles fetched');
    }
    
    await updateGenerationRun(runId, {
      articles_fetched_count: articles.length,
      news_sources_queried: 'NewsAPI,RSS',
    });
    
    await saveFetchedArticles(runId, articles);
    
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
    
    while (retryCount < MAX_RETRIES) {
      try {
        await updateGenerationRun(runId, { 
          status: 'generating' as const,
          retry_count: retryCount,
        });
        
        const { poll: generatedPoll, promptHash, rawInput, rawOutput } = await generatePoll(
          selectedCluster.topic,
          topicArticles
        );
        
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
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`[GENERATOR] Attempt ${retryCount} failed:`, lastError);
        
        await updateGenerationRun(runId, {
          retry_count: retryCount,
          error_message: lastError,
        });
        
        if (retryCount >= MAX_RETRIES) {
          break;
        }
      }
    }
    
    console.log('[GENERATOR] All retries exhausted, using fallback');
    
    const evergreen = await getEvergreenFallback();
    
    if (evergreen) {
      const fallbackPoll = evergreenToGeneratedPoll(evergreen);
      const pollId = await createPollFromGenerated(fallbackPoll, runId, false);
      
      await updateGenerationRun(runId, {
        status: 'fallback' as const,
        generated_poll_id: pollId,
        used_fallback: true,
        fallback_reason: `Generation failed after ${MAX_RETRIES} attempts: ${lastError}. Using evergreen poll.`,
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
    
    await updateGenerationRun(runId, {
      status: 'failed' as const,
      error_message: errorMessage,
      completed_at: new Date(),
    });
    
    console.error('[GENERATOR] Generation failed:', errorMessage);
    
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
