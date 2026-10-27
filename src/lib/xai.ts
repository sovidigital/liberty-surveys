import { GeneratedPoll, BiasCheckResult, NewsArticle } from '@/types';
import crypto from 'crypto';

const USE_MOCK = process.env.USE_MOCK_LLM === 'true' || process.env.USE_MOCK_DB === 'true';

// ============================================================================
// JSON Extraction Utilities
// ============================================================================

function extractJsonFromLlmResponse(text: string): string | null {
  // Strategy 1: Look for JSON in markdown code fences (most common LLM pattern)
  const fencePatterns = [
    /```json\s*([\s\S]*?)```/i,
    /```\s*([\s\S]*?)```/,
  ];
  
  for (const pattern of fencePatterns) {
    const match = text.match(pattern);
    if (match) {
      const content = match[1].trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        return content;
      }
    }
  }
  
  // Strategy 2: Find JSON object boundaries more carefully
  // Look for the first '{' that's followed by a valid JSON key pattern
  const jsonStartPattern = /\{[\s\n]*"[a-zA-Z_]/;
  const startMatch = text.match(jsonStartPattern);
  
  if (startMatch && startMatch.index !== undefined) {
    const startIdx = startMatch.index;
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = startIdx; i < text.length; i++) {
      const char = text[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escape = true;
        continue;
      }
      
      if (char === '"' && !escape) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') depth++;
        if (char === '}') {
          depth--;
          if (depth === 0) {
            return text.slice(startIdx, i + 1);
          }
        }
      }
    }
  }
  
  // Strategy 3: Fallback to greedy match (original behavior)
  const greedyMatch = text.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    return greedyMatch[0];
  }
  
  return null;
}

function parseJsonWithRecovery<T>(jsonStr: string, context: string): T {
  try {
    return JSON.parse(jsonStr);
  } catch (firstError) {
    // Try to fix common JSON issues from LLMs
    const fixed = jsonStr
      // Fix trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix unescaped newlines in strings (rare but happens)
      .replace(/([^\\])\n/g, '$1\\n');
    
    try {
      return JSON.parse(fixed);
    } catch {
      // Log the problematic JSON for debugging
      console.error(`[XAI] JSON parse failed for ${context}. First 500 chars:`, jsonStr.slice(0, 500));
      throw new Error(`Failed to parse JSON from LLM response (${context}): ${firstError instanceof Error ? firstError.message : 'unknown error'}`);
    }
  }
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MODEL = 'grok-4.7';
const DEFAULT_BIAS_CHECK_MODEL = 'grok-4.7';
const DEFAULT_LLM_TIMEOUT_MS = 90000; // 90 seconds per LLM call

export function getModelId(): string {
  return process.env.XAI_MODEL || DEFAULT_MODEL;
}

export function getBiasCheckModelId(): string {
  return process.env.XAI_BIAS_CHECK_MODEL || DEFAULT_BIAS_CHECK_MODEL;
}

export function getLlmTimeoutMs(): number {
  const envTimeout = process.env.LLM_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_LLM_TIMEOUT_MS;
}

export class LlmTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM call timed out after ${timeoutMs}ms`);
    this.name = 'LlmTimeoutError';
  }
}

// ============================================================================
// xAI Responses API Client
// ============================================================================

interface ResponsesMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ResponsesRequest {
  model: string;
  input: ResponsesMessage[];
  temperature?: number;
  max_output_tokens?: number;
  reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
  tools?: Array<{
    type: 'web_search' | 'x_search';
    filters?: {
      allowed_domains?: string[];
      excluded_domains?: string[];
    };
  }>;
}

interface ResponsesOutput {
  type: 'message';
  content: Array<{ type: 'text'; text: string }>;
}

interface ResponsesResponse {
  id: string;
  output: ResponsesOutput[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens?: number;
  };
}

async function invokeXaiModel(
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
    useWebSearch?: boolean;
    webSearchDomains?: string[];
    timeoutMs?: number;
  } = {}
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const {
    maxTokens = 4096,
    temperature = 0.7,
    reasoningEffort = 'low',
    useWebSearch = false,
    webSearchDomains,
    timeoutMs = getLlmTimeoutMs(),
  } = options;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const body: ResponsesRequest = {
    model: modelId,
    temperature,
    max_output_tokens: maxTokens,
    reasoning_effort: reasoningEffort,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  if (useWebSearch) {
    body.tools = [{
      type: 'web_search',
      ...(webSearchDomains && webSearchDomains.length > 0 && {
        filters: { allowed_domains: webSearchDomains.slice(0, 5) },
      }),
    }];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API error ${response.status}: ${errorText}`);
    }

    const data: ResponsesResponse = await response.json();

    const textContent = data.output
      .filter(o => o.type === 'message')
      .flatMap(o => o.content)
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return {
      text: textContent,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens + (data.usage.reasoning_tokens || 0),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmTimeoutError(timeoutMs);
    }
    throw error;
  }
}

// ============================================================================
// Poll Generation
// ============================================================================

const POLL_GENERATION_SYSTEM_PROMPT = `You are an expert political analyst creating daily polls for Liberty Surveys, a nonpartisan polling platform. Your task is to create engaging, balanced poll questions on current political topics.

CRITICAL REQUIREMENTS:
1. The question must be genuinely debatable with reasonable positions on multiple sides
2. Answer options must be balanced and non-leading (no loaded language)
3. Every factual claim in the briefing MUST be tied to one of the provided source articles
4. The three perspectives (conservative, liberal, centrist) must fairly represent each viewpoint
5. Use neutral, journalistic language throughout
6. Provide 2-4 answer options that cover the reasonable spectrum of opinions

OUTPUT FORMAT: Return ONLY valid JSON matching this schema:
{
  "question": "string - the poll question, phrased neutrally",
  "options": [
    {"text": "string - answer option 1"},
    {"text": "string - answer option 2"},
    {"text": "string - answer option 3 (optional)"},
    {"text": "string - answer option 4 (optional)"}
  ],
  "briefing": {
    "background": "string - 2-3 sentences of neutral factual background",
    "conservative": "string - 2-3 sentences representing the conservative perspective",
    "liberal": "string - 2-3 sentences representing the liberal perspective", 
    "centrist": "string - 2-3 sentences representing the independent/centrist perspective"
  },
  "sources": [
    {
      "sourceName": "string - outlet name",
      "sourceUrl": "string - article URL",
      "articleTitle": "string - article headline",
      "snippet": "string - relevant quote or summary from article",
      "politicalLean": "left|center-left|center|center-right|right",
      "usedForPerspective": "background|conservative|liberal|centrist"
    }
  ],
  "topicSummary": "string - brief description of why this topic was chosen"
}`;

function buildPollGenerationPrompt(topic: string, articles: NewsArticle[]): string {
  const articleSummaries = articles.map((a, i) => 
    `[${i + 1}] "${a.title}" - ${a.source.name} (${a.source.politicalLean})
URL: ${a.url}
Summary: ${a.description}
${a.content ? `Content excerpt: ${a.content.slice(0, 500)}...` : ''}`
  ).join('\n\n');
  
  return `Create a poll about the following topic: "${topic}"

Use ONLY these source articles for facts and citations:

${articleSummaries}

Remember:
- The question should be genuinely debatable
- Options should be balanced (2-4 options, no leading language)
- Every claim must cite a source from the list above
- Include perspectives from across the political spectrum
- Sources array must only include articles from the list above with matching URLs

Return ONLY the JSON object, no other text.`;
}

export async function generatePoll(
  topic: string,
  articles: NewsArticle[]
): Promise<{ poll: GeneratedPoll; promptHash: string; rawInput: string; rawOutput: string }> {
  const userPrompt = buildPollGenerationPrompt(topic, articles);
  const promptHash = crypto.createHash('sha256').update(userPrompt).digest('hex').slice(0, 16);
  
  if (USE_MOCK) {
    console.log('[XAI] Using mock poll generation');
    return {
      poll: getMockGeneratedPoll(topic, articles),
      promptHash,
      rawInput: userPrompt,
      rawOutput: JSON.stringify(getMockGeneratedPoll(topic, articles), null, 2),
    };
  }
  
  console.log(`[XAI] Generating poll for topic: ${topic}`);
  
  const { text, inputTokens, outputTokens } = await invokeXaiModel(
    getModelId(),
    POLL_GENERATION_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 4096, temperature: 0.7, reasoningEffort: 'low' }
  );
  
  console.log(`[XAI] Generation complete. Tokens: ${inputTokens} in, ${outputTokens} out`);
  
  const jsonStr = extractJsonFromLlmResponse(text);
  if (!jsonStr) {
    console.error('[XAI] Failed to extract JSON. Raw response:', text.slice(0, 1000));
    throw new Error('Failed to extract JSON from LLM response - no valid JSON structure found');
  }
  
  const poll = parseJsonWithRecovery<GeneratedPoll>(jsonStr, 'poll generation');
  
  // Validate required fields exist
  if (!poll.question || !Array.isArray(poll.options) || poll.options.length === 0) {
    throw new Error('Invalid poll structure: missing question or options');
  }
  
  return {
    poll,
    promptHash,
    rawInput: userPrompt,
    rawOutput: text,
  };
}

// ============================================================================
// Bias Checking
// ============================================================================

const BIAS_CHECK_SYSTEM_PROMPT = `You are an expert at detecting political bias in polling questions. Analyze the provided poll for neutrality and balance.

Score each dimension from 0.0 (very biased/unbalanced) to 1.0 (perfectly neutral/balanced):

1. questionBiasScore: Is the question phrased neutrally without leading language?
2. optionBalanceScore: Are the answer options fair and balanced?
3. perspectiveBalanceScore: Are the three perspectives (conservative, liberal, centrist) fairly represented?

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "questionBiasScore": number,
  "optionBalanceScore": number,
  "perspectiveBalanceScore": number,
  "overallScore": number,
  "issues": ["string - specific issues found"],
  "passesThreshold": boolean
}

A poll passes if overallScore >= 0.7 and no individual score is below 0.5.`;

export async function checkPollBias(poll: GeneratedPoll): Promise<BiasCheckResult> {
  const userPrompt = `Analyze this poll for bias and balance:

Question: ${poll.question}

Options:
${poll.options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')}

Background: ${poll.briefing.background}

Conservative perspective: ${poll.briefing.conservative}

Liberal perspective: ${poll.briefing.liberal}

Centrist perspective: ${poll.briefing.centrist}

Return ONLY the JSON analysis.`;

  if (USE_MOCK) {
    console.log('[XAI] Using mock bias check');
    return {
      questionBiasScore: 0.85,
      optionBalanceScore: 0.82,
      perspectiveBalanceScore: 0.88,
      overallScore: 0.85,
      issues: [],
      passesThreshold: true,
    };
  }
  
  console.log('[XAI] Running bias check...');
  
  const { text } = await invokeXaiModel(
    getBiasCheckModelId(),
    BIAS_CHECK_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 1024, temperature: 0.3, reasoningEffort: 'none' }
  );
  
  const jsonStr = extractJsonFromLlmResponse(text);
  if (!jsonStr) {
    console.error('[XAI] Failed to extract JSON from bias check. Raw response:', text.slice(0, 500));
    throw new Error('Failed to extract JSON from bias check response');
  }
  
  const result = parseJsonWithRecovery<BiasCheckResult>(jsonStr, 'bias check');
  
  result.passesThreshold = result.overallScore >= 0.7 &&
    result.questionBiasScore >= 0.5 &&
    result.optionBalanceScore >= 0.5 &&
    result.perspectiveBalanceScore >= 0.5;
  
  console.log(`[XAI] Bias check complete. Overall score: ${result.overallScore}, passes: ${result.passesThreshold}`);
  
  return result;
}

// ============================================================================
// Citation Validation
// ============================================================================

export function validateCitations(
  poll: GeneratedPoll,
  sourceArticles: NewsArticle[]
): { valid: boolean; invalidSources: string[]; score: number } {
  const articleUrls = new Set(sourceArticles.map(a => a.url));
  const invalidSources: string[] = [];
  
  for (const source of poll.sources) {
    if (!articleUrls.has(source.sourceUrl)) {
      invalidSources.push(source.sourceUrl);
    }
  }
  
  const validCount = poll.sources.length - invalidSources.length;
  const score = poll.sources.length > 0 ? validCount / poll.sources.length : 0;
  
  return {
    valid: invalidSources.length === 0,
    invalidSources,
    score,
  };
}

// ============================================================================
// Mock Data
// ============================================================================

function getMockGeneratedPoll(topic: string, articles: NewsArticle[]): GeneratedPoll {
  const leftArticle = articles.find(a => a.source.politicalLean === 'left' || a.source.politicalLean === 'center-left') || articles[0];
  const rightArticle = articles.find(a => a.source.politicalLean === 'right' || a.source.politicalLean === 'center-right') || articles[1];
  const centerArticle = articles.find(a => a.source.politicalLean === 'center') || articles[2] || articles[0];
  
  return {
    question: `[SAMPLE] Should Congress pass the proposed ${topic} legislation?`,
    options: [
      { text: 'Yes, pass it as proposed' },
      { text: 'Yes, but with modifications' },
      { text: 'No, reject the proposal' },
      { text: 'Undecided / Need more information' },
    ],
    briefing: {
      background: `[SAMPLE DATA] Congress is currently debating legislation related to ${topic}. The bill has bipartisan sponsors but faces opposition from some members. A vote is expected in the coming weeks, with significant implications for policy in this area.`,
      conservative: `[SAMPLE DATA] Conservative lawmakers argue that the proposal goes too far and could have unintended economic consequences. They prefer a more limited approach that preserves individual choice and reduces government involvement. Some suggest the issue should be left to states rather than federal action.`,
      liberal: `[SAMPLE DATA] Progressive advocates contend that the legislation doesn't go far enough to address the underlying issues. They argue for more comprehensive reforms that would provide broader protections and increased federal investment. Some push for amendments to strengthen the bill's provisions.`,
      centrist: `[SAMPLE DATA] Moderate voices in both parties see potential for compromise. They support the bill's core objectives while acknowledging legitimate concerns from both sides. Many centrists advocate for targeted amendments that could broaden support without undermining the legislation's effectiveness.`,
    },
    sources: [
      {
        sourceName: leftArticle?.source.name || 'Sample News',
        sourceUrl: leftArticle?.url || 'https://example.com/article1',
        articleTitle: leftArticle?.title || 'Sample Article',
        snippet: leftArticle?.description || 'Sample description',
        politicalLean: leftArticle?.source.politicalLean || 'center-left',
        usedForPerspective: 'liberal',
      },
      {
        sourceName: rightArticle?.source.name || 'Sample News',
        sourceUrl: rightArticle?.url || 'https://example.com/article2',
        articleTitle: rightArticle?.title || 'Sample Article',
        snippet: rightArticle?.description || 'Sample description',
        politicalLean: rightArticle?.source.politicalLean || 'center-right',
        usedForPerspective: 'conservative',
      },
      {
        sourceName: centerArticle?.source.name || 'Sample News',
        sourceUrl: centerArticle?.url || 'https://example.com/article3',
        articleTitle: centerArticle?.title || 'Sample Article',
        snippet: centerArticle?.description || 'Sample description',
        politicalLean: centerArticle?.source.politicalLean || 'center',
        usedForPerspective: 'background',
      },
    ],
    topicSummary: `This topic was selected because ${topic} is currently being debated in Congress with coverage from multiple perspectives across the political spectrum.`,
  };
}
