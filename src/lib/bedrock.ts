import { GeneratedPoll, BiasCheckResult, NewsArticle } from '@/types';
import crypto from 'crypto';

const USE_MOCK = process.env.USE_MOCK_LLM === 'true' || process.env.USE_MOCK_DB === 'true';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const BIAS_CHECK_MODEL = 'anthropic.claude-3-haiku-20240307-v1:0';

export function getModelId(): string {
  return process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL;
}

export function getBiasCheckModelId(): string {
  return process.env.BEDROCK_BIAS_CHECK_MODEL_ID || BIAS_CHECK_MODEL;
}

// ============================================================================
// AWS Bedrock Client
// ============================================================================

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BedrockRequest {
  anthropic_version: string;
  max_tokens: number;
  messages: BedrockMessage[];
  system?: string;
  temperature?: number;
}

interface BedrockResponse {
  content: Array<{ type: string; text: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

async function invokeBedrockModel(
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { maxTokens = 4096, temperature = 0.7 } = options;
  
  const region = process.env.AWS_REGION || 'us-east-1';
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;
  
  const body: BedrockRequest = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };
  
  const bodyString = JSON.stringify(body);
  
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured');
  }
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    'Host': `bedrock-runtime.${region}.amazonaws.com`,
  };
  
  if (sessionToken) {
    headers['X-Amz-Security-Token'] = sessionToken;
  }
  
  const canonicalUri = `/model/${encodeURIComponent(modelId)}/invoke`;
  const canonicalQueryString = '';
  const signedHeaders = Object.keys(headers).sort().map(k => k.toLowerCase()).join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(k => `${k.toLowerCase()}:${headers[k].trim()}`)
    .join('\n') + '\n';
  
  const payloadHash = crypto.createHash('sha256').update(bodyString).digest('hex');
  const canonicalRequest = [
    'POST',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/bedrock/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  
  const getSignatureKey = (key: string, dateStamp: string, region: string, service: string) => {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  };
  
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, 'bedrock');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  headers['Authorization'] = authorizationHeader;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: bodyString,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bedrock API error ${response.status}: ${errorText}`);
  }
  
  const data: BedrockResponse = await response.json();
  
  return {
    text: data.content[0]?.text || '',
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  };
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
    console.log('[BEDROCK] Using mock poll generation');
    return {
      poll: getMockGeneratedPoll(topic, articles),
      promptHash,
      rawInput: userPrompt,
      rawOutput: JSON.stringify(getMockGeneratedPoll(topic, articles), null, 2),
    };
  }
  
  console.log(`[BEDROCK] Generating poll for topic: ${topic}`);
  
  const { text, inputTokens, outputTokens } = await invokeBedrockModel(
    getModelId(),
    POLL_GENERATION_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 4096, temperature: 0.7 }
  );
  
  console.log(`[BEDROCK] Generation complete. Tokens: ${inputTokens} in, ${outputTokens} out`);
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from LLM response');
  }
  
  const poll: GeneratedPoll = JSON.parse(jsonMatch[0]);
  
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
    console.log('[BEDROCK] Using mock bias check');
    return {
      questionBiasScore: 0.85,
      optionBalanceScore: 0.82,
      perspectiveBalanceScore: 0.88,
      overallScore: 0.85,
      issues: [],
      passesThreshold: true,
    };
  }
  
  console.log('[BEDROCK] Running bias check...');
  
  const { text } = await invokeBedrockModel(
    getBiasCheckModelId(),
    BIAS_CHECK_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 1024, temperature: 0.3 }
  );
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from bias check response');
  }
  
  const result: BiasCheckResult = JSON.parse(jsonMatch[0]);
  
  result.passesThreshold = result.overallScore >= 0.7 &&
    result.questionBiasScore >= 0.5 &&
    result.optionBalanceScore >= 0.5 &&
    result.perspectiveBalanceScore >= 0.5;
  
  console.log(`[BEDROCK] Bias check complete. Overall score: ${result.overallScore}, passes: ${result.passesThreshold}`);
  
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
