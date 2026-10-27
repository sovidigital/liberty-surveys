import { NewsArticle, PoliticalLean, TopicCluster } from '@/types';

const USE_MOCK = process.env.USE_MOCK_NEWS === 'true' || process.env.USE_MOCK_DB === 'true';

// ============================================================================
// News Source Configuration
// ============================================================================

interface NewsSource {
  name: string;
  domain: string;
  politicalLean: PoliticalLean;
  rssUrl?: string;
}

// Balanced RSS sources across the political spectrum
// Configure additional sources via NEWS_SOURCES_JSON env var (JSON array)
const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  // Left-leaning sources
  { 
    name: 'CNN', 
    domain: 'cnn.com', 
    politicalLean: 'left', 
    rssUrl: 'http://rss.cnn.com/rss/cnn_topstories.rss' 
  },
  { 
    name: 'The Guardian', 
    domain: 'theguardian.com', 
    politicalLean: 'left', 
    rssUrl: 'https://www.theguardian.com/us-news/rss' 
  },
  { 
    name: 'MSNBC', 
    domain: 'msnbc.com', 
    politicalLean: 'left', 
    rssUrl: 'https://www.msnbc.com/feeds/latest' 
  },

  // Center-left sources
  { 
    name: 'The New York Times', 
    domain: 'nytimes.com', 
    politicalLean: 'center-left', 
    rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml' 
  },
  { 
    name: 'The Washington Post', 
    domain: 'washingtonpost.com', 
    politicalLean: 'center-left', 
    rssUrl: 'https://feeds.washingtonpost.com/rss/politics' 
  },
  { 
    name: 'NPR', 
    domain: 'npr.org', 
    politicalLean: 'center-left', 
    rssUrl: 'https://feeds.npr.org/1001/rss.xml' 
  },
  { 
    name: 'Politico', 
    domain: 'politico.com', 
    politicalLean: 'center-left', 
    rssUrl: 'https://rss.politico.com/politics-news.xml' 
  },

  // Center sources
  { 
    name: 'Associated Press', 
    domain: 'apnews.com', 
    politicalLean: 'center', 
    rssUrl: 'https://rsshub.app/apnews/topics/apf-politics' 
  },
  { 
    name: 'Reuters', 
    domain: 'reuters.com', 
    politicalLean: 'center', 
    rssUrl: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best' 
  },
  { 
    name: 'BBC', 
    domain: 'bbc.com', 
    politicalLean: 'center', 
    rssUrl: 'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' 
  },
  { 
    name: 'The Hill', 
    domain: 'thehill.com', 
    politicalLean: 'center', 
    rssUrl: 'https://thehill.com/news/feed/' 
  },
  { 
    name: 'Axios', 
    domain: 'axios.com', 
    politicalLean: 'center', 
    rssUrl: 'https://api.axios.com/feed/' 
  },
  { 
    name: 'PBS NewsHour', 
    domain: 'pbs.org', 
    politicalLean: 'center', 
    rssUrl: 'https://www.pbs.org/newshour/feeds/rss/headlines' 
  },

  // Center-right sources
  { 
    name: 'Wall Street Journal', 
    domain: 'wsj.com', 
    politicalLean: 'center-right', 
    rssUrl: 'https://feeds.a.dj.com/rss/RSSOpinion.xml' 
  },
  { 
    name: 'The Economist', 
    domain: 'economist.com', 
    politicalLean: 'center-right', 
    rssUrl: 'https://www.economist.com/united-states/rss.xml' 
  },
  { 
    name: 'RealClearPolitics', 
    domain: 'realclearpolitics.com', 
    politicalLean: 'center-right', 
    rssUrl: 'https://www.realclearpolitics.com/index.xml' 
  },

  // Right-leaning sources
  { 
    name: 'Fox News', 
    domain: 'foxnews.com', 
    politicalLean: 'right', 
    rssUrl: 'https://moxie.foxnews.com/google-publisher/politics.xml' 
  },
  { 
    name: 'New York Post', 
    domain: 'nypost.com', 
    politicalLean: 'right', 
    rssUrl: 'https://nypost.com/news/feed/' 
  },
  { 
    name: 'National Review', 
    domain: 'nationalreview.com', 
    politicalLean: 'right', 
    rssUrl: 'https://www.nationalreview.com/feed/' 
  },
  { 
    name: 'The Daily Wire', 
    domain: 'dailywire.com', 
    politicalLean: 'right', 
    rssUrl: 'https://www.dailywire.com/feeds/rss.xml' 
  },
  { 
    name: 'Washington Examiner', 
    domain: 'washingtonexaminer.com', 
    politicalLean: 'right', 
    rssUrl: 'https://www.washingtonexaminer.com/section/news/feed' 
  },
  { 
    name: 'The Federalist', 
    domain: 'thefederalist.com', 
    politicalLean: 'right', 
    rssUrl: 'https://thefederalist.com/feed/' 
  },
];

function getConfiguredSources(): NewsSource[] {
  const customSourcesJson = process.env.NEWS_SOURCES_JSON;
  
  if (customSourcesJson) {
    try {
      const customSources = JSON.parse(customSourcesJson) as NewsSource[];
      console.log(`[NEWS] Using ${customSources.length} custom news sources from NEWS_SOURCES_JSON`);
      return customSources;
    } catch (error) {
      console.warn('[NEWS] Failed to parse NEWS_SOURCES_JSON, using defaults:', error);
    }
  }
  
  return DEFAULT_NEWS_SOURCES;
}

export const NEWS_SOURCES = getConfiguredSources();

export function getSourcePoliticalLean(sourceName: string, sourceUrl: string): PoliticalLean {
  const normalizedName = sourceName.toLowerCase();
  const normalizedUrl = sourceUrl.toLowerCase();
  
  for (const source of NEWS_SOURCES) {
    if (normalizedName.includes(source.name.toLowerCase()) || 
        normalizedUrl.includes(source.domain)) {
      return source.politicalLean;
    }
  }
  
  return 'center';
}

export function getSourceBalance(): { left: number; centerLeft: number; center: number; centerRight: number; right: number } {
  const sources = NEWS_SOURCES.filter(s => s.rssUrl);
  return {
    left: sources.filter(s => s.politicalLean === 'left').length,
    centerLeft: sources.filter(s => s.politicalLean === 'center-left').length,
    center: sources.filter(s => s.politicalLean === 'center').length,
    centerRight: sources.filter(s => s.politicalLean === 'center-right').length,
    right: sources.filter(s => s.politicalLean === 'right').length,
  };
}

// ============================================================================
// RSS Feed Fetching
// ============================================================================

async function fetchFromRSS(source: NewsSource): Promise<NewsArticle[]> {
  if (!source.rssUrl) return [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(source.rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LibertySurveys/1.0 (Political Polling Platform)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[NEWS] RSS fetch failed for ${source.name}:`, response.status);
      return [];
    }
    
    const xml = await response.text();
    const articles = parseRSSFeed(xml, source);
    
    console.log(`[NEWS] Fetched ${articles.length} articles from ${source.name}`);
    return articles;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[NEWS] RSS timeout for ${source.name}`);
    } else {
      console.warn(`[NEWS] RSS error for ${source.name}:`, error);
    }
    return [];
  }
}

function parseRSSFeed(xml: string, source: NewsSource): NewsArticle[] {
  const articles: NewsArticle[] = [];
  
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    const title = extractXMLTag(item, 'title');
    const description = extractXMLTag(item, 'description') || extractXMLTag(item, 'summary');
    const link = extractXMLTag(item, 'link') || extractXMLTag(item, 'guid');
    const pubDate = extractXMLTag(item, 'pubDate') || extractXMLTag(item, 'published');
    const content = extractXMLTag(item, 'content:encoded') || extractXMLTag(item, 'content');
    
    if (title && link) {
      articles.push({
        title: cleanHTMLEntities(title),
        description: cleanHTMLEntities(description || ''),
        content: content ? cleanHTMLEntities(content).slice(0, 1000) : null,
        url: link.trim(),
        source: {
          name: source.name,
          politicalLean: source.politicalLean,
        },
        publishedAt: pubDate ? new Date(pubDate) : new Date(),
      });
    }
  }
  
  return articles;
}

function extractXMLTag(xml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  
  const simpleRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const simpleMatch = xml.match(simpleRegex);
  if (simpleMatch) return simpleMatch[1].trim();
  
  return null;
}

function cleanHTMLEntities(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .trim();
}

// ============================================================================
// xAI Web Search Integration
// ============================================================================

interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}

async function searchWithXai(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    console.warn('[NEWS] XAI_API_KEY not set, skipping web search');
    return [];
  }
  
  try {
    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.XAI_MODEL || 'grok-4.7',
        input: [
          { role: 'system', content: 'You are a research assistant. Search for recent news articles about the given political topic. Return ONLY a JSON array of articles with url, title, and snippet fields. Include articles from diverse political perspectives.' },
          { role: 'user', content: `Find recent news articles about: ${query}` },
        ],
        tools: [{ type: 'web_search' }],
        max_output_tokens: 2048,
        reasoning_effort: 'none',
      }),
    });
    
    if (!response.ok) {
      console.warn('[NEWS] xAI web search failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    const text = data.output
      ?.filter((o: { type: string }) => o.type === 'message')
      ?.flatMap((o: { content: Array<{ type: string; text: string }> }) => o.content)
      ?.filter((c: { type: string }) => c.type === 'text')
      ?.map((c: { text: string }) => c.text)
      ?.join('') || '';
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]) as WebSearchResult[];
      console.log(`[NEWS] xAI search found ${results.length} articles for "${query}"`);
      return results;
    }
    
    return [];
  } catch (error) {
    console.warn('[NEWS] xAI web search error:', error);
    return [];
  }
}

async function verifyAndFetchUrl(url: string): Promise<{ title: string; description: string; content: string | null } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LibertySurveys/1.0 (Political Polling Platform)',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? cleanHTMLEntities(titleMatch[1]) : '';
    
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = descMatch ? cleanHTMLEntities(descMatch[1]) : '';
    
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const content = articleMatch ? cleanHTMLEntities(articleMatch[1]).slice(0, 1000) : null;
    
    return { title, description, content };
  } catch {
    return null;
  }
}

export async function supplementWithWebSearch(
  topic: string,
  existingUrls: Set<string>
): Promise<NewsArticle[]> {
  if (USE_MOCK) return [];
  
  console.log(`[NEWS] Supplementing with xAI web search for: ${topic}`);
  
  const searchResults = await searchWithXai(`${topic} political news recent`);
  const supplementedArticles: NewsArticle[] = [];
  
  for (const result of searchResults) {
    if (existingUrls.has(result.url)) continue;
    
    const verified = await verifyAndFetchUrl(result.url);
    if (!verified) continue;
    
    const politicalLean = getSourcePoliticalLean('', result.url);
    
    supplementedArticles.push({
      title: verified.title || result.title,
      description: verified.description || result.snippet,
      content: verified.content,
      url: result.url,
      source: {
        name: extractDomainName(result.url),
        politicalLean,
      },
      publishedAt: new Date(),
    });
    
    existingUrls.add(result.url);
  }
  
  console.log(`[NEWS] Web search added ${supplementedArticles.length} verified articles`);
  return supplementedArticles;
}

function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return 'Unknown';
  }
}

// ============================================================================
// Mock News Data
// ============================================================================

function getMockNewsArticles(): NewsArticle[] {
  const now = new Date();
  
  return [
    {
      title: 'Congress Debates New Infrastructure Bill',
      description: 'Lawmakers are divided on a proposed $500 billion infrastructure package that would fund roads, bridges, and broadband expansion.',
      content: 'The House is expected to vote on the measure next week...',
      url: 'https://apnews.com/article/infrastructure-bill-2026',
      source: { name: 'Associated Press', politicalLean: 'center' },
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      title: 'Infrastructure Plan Faces Republican Opposition',
      description: 'GOP leaders criticize the spending levels in the proposed infrastructure bill.',
      content: 'Senate Republicans have raised concerns about the price tag...',
      url: 'https://foxnews.com/politics/infrastructure-gop-opposition',
      source: { name: 'Fox News', politicalLean: 'right' },
      publishedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
    {
      title: 'Democrats Push for Broader Infrastructure Investment',
      description: 'Progressive lawmakers argue the bill should include climate provisions.',
      content: 'The Congressional Progressive Caucus is pushing for amendments...',
      url: 'https://cnn.com/politics/infrastructure-democrats-climate',
      source: { name: 'CNN', politicalLean: 'left' },
      publishedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      title: 'Analysis: The Infrastructure Compromise',
      description: 'Both parties see potential gains in passing bipartisan legislation.',
      content: 'Political analysts suggest both parties have incentives to negotiate...',
      url: 'https://thehill.com/opinion/infrastructure-compromise-analysis',
      source: { name: 'The Hill', politicalLean: 'center' },
      publishedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      title: 'White House Defends Infrastructure Priorities',
      description: 'Administration officials make the case for the spending package.',
      content: 'Press secretary outlined the economic benefits of the proposal...',
      url: 'https://nytimes.com/politics/white-house-infrastructure',
      source: { name: 'The New York Times', politicalLean: 'center-left' },
      publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      title: 'Conservative Groups Question Infrastructure Costs',
      description: 'Think tanks argue for more limited federal involvement.',
      content: 'The Heritage Foundation released a study on alternative approaches...',
      url: 'https://nationalreview.com/infrastructure-costs-analysis',
      source: { name: 'National Review', politicalLean: 'right' },
      publishedAt: new Date(now.getTime() - 7 * 60 * 60 * 1000),
    },
    {
      title: 'State Governors Weigh In on Federal Infrastructure Plans',
      description: 'Bipartisan group of governors supports federal investment.',
      content: 'The National Governors Association issued a joint statement...',
      url: 'https://reuters.com/article/governors-infrastructure-support',
      source: { name: 'Reuters', politicalLean: 'center' },
      publishedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      title: 'Labor Unions Back Infrastructure Package',
      description: 'Major unions see job creation opportunities in the bill.',
      content: 'AFL-CIO president praised the investment in American workers...',
      url: 'https://washingtonpost.com/politics/unions-infrastructure-support',
      source: { name: 'The Washington Post', politicalLean: 'center-left' },
      publishedAt: new Date(now.getTime() - 9 * 60 * 60 * 1000),
    },
  ];
}

// ============================================================================
// Topic Clustering
// ============================================================================

export function clusterArticlesByTopic(articles: NewsArticle[]): TopicCluster[] {
  const keywordClusters: Map<string, NewsArticle[]> = new Map();
  
  const politicalKeywords = [
    'congress', 'senate', 'house', 'bill', 'legislation', 'vote', 'election',
    'supreme court', 'scotus', 'ruling', 'decision', 'court',
    'president', 'administration', 'white house', 'executive',
    'tax', 'budget', 'spending', 'deficit', 'economy', 'inflation',
    'immigration', 'border', 'asylum', 'deportation',
    'healthcare', 'medicare', 'medicaid', 'insurance',
    'climate', 'environment', 'energy', 'emissions',
    'gun', 'firearm', 'second amendment', 'shooting',
    'abortion', 'reproductive', 'roe',
    'education', 'student', 'school', 'university',
    'military', 'defense', 'foreign policy', 'sanctions',
    'privacy', 'surveillance', 'data', 'tech regulation',
    'infrastructure', 'roads', 'bridges', 'broadband',
  ];
  
  for (const article of articles) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    
    for (const keyword of politicalKeywords) {
      if (text.includes(keyword)) {
        const existing = keywordClusters.get(keyword) || [];
        existing.push(article);
        keywordClusters.set(keyword, existing);
      }
    }
  }
  
  const clusters: TopicCluster[] = [];
  
  for (const [keyword, clusterArticles] of keywordClusters) {
    if (clusterArticles.length < 2) continue;
    
    const leanCounts = { left: 0, 'center-left': 0, center: 0, 'center-right': 0, right: 0 };
    for (const article of clusterArticles) {
      leanCounts[article.source.politicalLean]++;
    }
    
    const hasLeftCoverage = leanCounts.left > 0 || leanCounts['center-left'] > 0;
    const hasRightCoverage = leanCounts.right > 0 || leanCounts['center-right'] > 0;
    const hasCenterCoverage = leanCounts.center > 0;
    const coverageBreadth = [hasLeftCoverage, hasCenterCoverage, hasRightCoverage].filter(Boolean).length;
    
    const uniqueSources = new Set(clusterArticles.map(a => a.source.name));
    const prominenceScore = clusterArticles.length * 10 + uniqueSources.size * 5;
    
    const debatabilityScore = coverageBreadth >= 2 ? 80 : coverageBreadth === 1 ? 40 : 20;
    
    clusters.push({
      topic: keyword,
      keywords: [keyword],
      articles: clusterArticles,
      prominenceScore,
      coverageBreadth,
      debatabilityScore,
    });
  }
  
  clusters.sort((a, b) => {
    const scoreA = a.prominenceScore + a.debatabilityScore + a.coverageBreadth * 20;
    const scoreB = b.prominenceScore + b.debatabilityScore + b.coverageBreadth * 20;
    return scoreB - scoreA;
  });
  
  return clusters;
}

// ============================================================================
// Main Fetch Function
// ============================================================================

export interface FetchNewsOptions {
  maxArticles?: number;
  useWebSearch?: boolean;
  webSearchQuery?: string;
}

export async function fetchNews(options: FetchNewsOptions = {}): Promise<NewsArticle[]> {
  const {
    maxArticles = 200,
    useWebSearch = true,
    webSearchQuery = 'US politics current events',
  } = options;
  
  if (USE_MOCK) {
    console.log('[NEWS] Using mock news data');
    return getMockNewsArticles();
  }
  
  const sources = NEWS_SOURCES.filter(s => s.rssUrl);
  const balance = getSourceBalance();
  console.log(`[NEWS] Fetching from ${sources.length} RSS sources...`);
  console.log(`[NEWS] Source balance: Left=${balance.left}, CenterLeft=${balance.centerLeft}, Center=${balance.center}, CenterRight=${balance.centerRight}, Right=${balance.right}`);
  
  const allArticles: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  
  const rssPromises = sources.map(source => fetchFromRSS(source));
  const rssResults = await Promise.allSettled(rssPromises);
  
  for (const result of rssResults) {
    if (result.status === 'fulfilled') {
      for (const article of result.value) {
        if (!seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          allArticles.push(article);
        }
      }
    }
  }
  
  console.log(`[NEWS] Fetched ${allArticles.length} articles from RSS feeds`);
  
  if (useWebSearch && allArticles.length < maxArticles / 2) {
    const webArticles = await supplementWithWebSearch(webSearchQuery, seenUrls);
    allArticles.push(...webArticles);
  }
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(a => a.publishedAt > oneDayAgo);
  
  recentArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  
  console.log(`[NEWS] Total: ${recentArticles.length} recent articles`);
  
  return recentArticles.slice(0, maxArticles);
}

export async function fetchArticlesForTopic(
  topic: string,
  existingArticles: NewsArticle[],
  targetCount: number = 10
): Promise<NewsArticle[]> {
  const topicArticles = existingArticles.filter(article => {
    const text = `${article.title} ${article.description}`.toLowerCase();
    return text.includes(topic.toLowerCase());
  });
  
  if (topicArticles.length >= targetCount) {
    return topicArticles.slice(0, targetCount);
  }
  
  if (!USE_MOCK) {
    const existingUrls = new Set(topicArticles.map(a => a.url));
    const supplemented = await supplementWithWebSearch(topic, existingUrls);
    
    for (const article of supplemented) {
      topicArticles.push(article);
      if (topicArticles.length >= targetCount) break;
    }
  }
  
  return topicArticles;
}
