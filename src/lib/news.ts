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

export const NEWS_SOURCES: NewsSource[] = [
  // Left-leaning
  { name: 'CNN', domain: 'cnn.com', politicalLean: 'left', rssUrl: 'http://rss.cnn.com/rss/cnn_topstories.rss' },
  { name: 'MSNBC', domain: 'msnbc.com', politicalLean: 'left' },
  { name: 'The New York Times', domain: 'nytimes.com', politicalLean: 'center-left', rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml' },
  { name: 'The Washington Post', domain: 'washingtonpost.com', politicalLean: 'center-left' },
  { name: 'NPR', domain: 'npr.org', politicalLean: 'center-left', rssUrl: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'The Guardian', domain: 'theguardian.com', politicalLean: 'left', rssUrl: 'https://www.theguardian.com/us-news/rss' },
  
  // Center
  { name: 'Associated Press', domain: 'apnews.com', politicalLean: 'center', rssUrl: 'https://rsshub.app/apnews/topics/apf-politics' },
  { name: 'Reuters', domain: 'reuters.com', politicalLean: 'center', rssUrl: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best' },
  { name: 'BBC', domain: 'bbc.com', politicalLean: 'center', rssUrl: 'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
  { name: 'PBS', domain: 'pbs.org', politicalLean: 'center' },
  { name: 'The Hill', domain: 'thehill.com', politicalLean: 'center', rssUrl: 'https://thehill.com/news/feed/' },
  { name: 'Axios', domain: 'axios.com', politicalLean: 'center' },
  
  // Right-leaning
  { name: 'Fox News', domain: 'foxnews.com', politicalLean: 'right', rssUrl: 'https://moxie.foxnews.com/google-publisher/politics.xml' },
  { name: 'Wall Street Journal', domain: 'wsj.com', politicalLean: 'center-right' },
  { name: 'New York Post', domain: 'nypost.com', politicalLean: 'right', rssUrl: 'https://nypost.com/news/feed/' },
  { name: 'The Federalist', domain: 'thefederalist.com', politicalLean: 'right' },
  { name: 'National Review', domain: 'nationalreview.com', politicalLean: 'right', rssUrl: 'https://www.nationalreview.com/feed/' },
  { name: 'The Daily Wire', domain: 'dailywire.com', politicalLean: 'right' },
];

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

// ============================================================================
// NewsAPI.org Client
// ============================================================================

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: Array<{
    source: { id: string | null; name: string };
    author: string | null;
    title: string;
    description: string;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    content: string | null;
  }>;
}

async function fetchFromNewsAPI(query: string = 'politics'): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  if (!apiKey) {
    console.warn('[NEWS] NewsAPI key not configured, skipping');
    return [];
  }
  
  try {
    const params = new URLSearchParams({
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '100',
    });
    
    const response = await fetch(
      `https://newsapi.org/v2/everything?${params}`,
      {
        headers: { 'X-Api-Key': apiKey },
        next: { revalidate: 0 },
      }
    );
    
    if (!response.ok) {
      console.error('[NEWS] NewsAPI error:', response.status, await response.text());
      return [];
    }
    
    const data: NewsAPIResponse = await response.json();
    
    return data.articles
      .filter(article => article.title && article.url)
      .map(article => ({
        title: article.title,
        description: article.description || '',
        content: article.content,
        url: article.url,
        source: {
          name: article.source.name,
          politicalLean: getSourcePoliticalLean(article.source.name, article.url),
        },
        publishedAt: new Date(article.publishedAt),
      }));
  } catch (error) {
    console.error('[NEWS] NewsAPI fetch error:', error);
    return [];
  }
}

// ============================================================================
// RSS Feed Fetching
// ============================================================================

async function fetchFromRSS(source: NewsSource): Promise<NewsArticle[]> {
  if (!source.rssUrl) return [];
  
  try {
    const response = await fetch(source.rssUrl, {
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'LibertySurveys/1.0',
      },
    });
    
    if (!response.ok) {
      console.warn(`[NEWS] RSS fetch failed for ${source.name}:`, response.status);
      return [];
    }
    
    const xml = await response.text();
    const articles = parseRSSFeed(xml, source);
    
    return articles;
  } catch (error) {
    console.warn(`[NEWS] RSS error for ${source.name}:`, error);
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
    
    if (title && link) {
      articles.push({
        title: cleanHTMLEntities(title),
        description: cleanHTMLEntities(description || ''),
        content: null,
        url: link,
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
    .trim();
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
      url: 'https://example.com/infrastructure-bill',
      source: { name: 'Associated Press', politicalLean: 'center' },
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      title: 'Infrastructure Plan Faces Republican Opposition',
      description: 'GOP leaders criticize the spending levels in the proposed infrastructure bill.',
      content: 'Senate Republicans have raised concerns about the price tag...',
      url: 'https://example.com/gop-infrastructure',
      source: { name: 'Fox News', politicalLean: 'right' },
      publishedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
    {
      title: 'Democrats Push for Broader Infrastructure Investment',
      description: 'Progressive lawmakers argue the bill should include climate provisions.',
      content: 'The Congressional Progressive Caucus is pushing for amendments...',
      url: 'https://example.com/dem-infrastructure',
      source: { name: 'CNN', politicalLean: 'left' },
      publishedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      title: 'Supreme Court to Hear Major Privacy Case',
      description: 'The court will decide whether warrants are required for location data.',
      content: 'Civil liberties groups are watching the case closely...',
      url: 'https://example.com/scotus-privacy',
      source: { name: 'Reuters', politicalLean: 'center' },
      publishedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      title: 'Privacy Advocates Urge Strong Protections',
      description: 'Groups argue that digital privacy requires updated legal frameworks.',
      content: 'The ACLU filed an amicus brief supporting warrant requirements...',
      url: 'https://example.com/privacy-advocates',
      source: { name: 'The New York Times', politicalLean: 'center-left' },
      publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      title: 'Law Enforcement Groups Warn Against New Restrictions',
      description: 'Police associations say warrant requirements could hinder investigations.',
      content: 'The Fraternal Order of Police submitted testimony...',
      url: 'https://example.com/law-enforcement-privacy',
      source: { name: 'National Review', politicalLean: 'right' },
      publishedAt: new Date(now.getTime() - 7 * 60 * 60 * 1000),
    },
    {
      title: 'Federal Reserve Signals Potential Rate Changes',
      description: 'The Fed chair hints at possible adjustments to monetary policy.',
      content: 'In remarks to Congress, the chair discussed inflation concerns...',
      url: 'https://example.com/fed-rates',
      source: { name: 'Wall Street Journal', politicalLean: 'center-right' },
      publishedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      title: 'Economists Debate Inflation Response',
      description: 'Experts disagree on whether current policies are sufficient.',
      content: 'Some economists argue for more aggressive action...',
      url: 'https://example.com/inflation-debate',
      source: { name: 'The Hill', politicalLean: 'center' },
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
  queries?: string[];
  maxArticles?: number;
  includeRSS?: boolean;
}

export async function fetchNews(options: FetchNewsOptions = {}): Promise<NewsArticle[]> {
  const {
    queries = ['politics', 'congress', 'policy'],
    maxArticles = 200,
    includeRSS = true,
  } = options;
  
  if (USE_MOCK) {
    console.log('[NEWS] Using mock news data');
    return getMockNewsArticles();
  }
  
  console.log('[NEWS] Fetching news from multiple sources...');
  
  const allArticles: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  
  for (const query of queries) {
    const newsApiArticles = await fetchFromNewsAPI(query);
    for (const article of newsApiArticles) {
      if (!seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        allArticles.push(article);
      }
    }
  }
  
  if (includeRSS) {
    const rssPromises = NEWS_SOURCES
      .filter(s => s.rssUrl)
      .map(source => fetchFromRSS(source));
    
    const rssResults = await Promise.all(rssPromises);
    
    for (const articles of rssResults) {
      for (const article of articles) {
        if (!seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          allArticles.push(article);
        }
      }
    }
  }
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(a => a.publishedAt > oneDayAgo);
  
  recentArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  
  console.log(`[NEWS] Fetched ${recentArticles.length} recent articles`);
  
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
    const additionalArticles = await fetchFromNewsAPI(topic);
    const seenUrls = new Set(topicArticles.map(a => a.url));
    
    for (const article of additionalArticles) {
      if (!seenUrls.has(article.url)) {
        topicArticles.push(article);
        if (topicArticles.length >= targetCount) break;
      }
    }
  }
  
  return topicArticles;
}
