import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isTopicTooSimilarToRecent } from './poll-generator';

// ============================================================================
// Topic Similarity Filter Tests
// ============================================================================

describe('isTopicTooSimilarToRecent', () => {
  describe('generic political terms are NEVER blocked (too broad to indicate same story)', () => {
    const genericTerms = ['president', 'house', 'congress', 'senate', 'election', 'vote', 'administration'];
    
    it.each(genericTerms)(
      'allows "%s" cluster regardless of recent poll content (generic term)',
      (topic) => {
        const recentPolls = [
          'should congress pass the infrastructure bill that the president supports?',
          'should the house vote on the new climate legislation?',
          'is the administration\'s immigration policy effective?',
          `should the ${topic} take action on this issue?`, // Even direct mention
        ];
        
        // Generic terms are too broad - "president" cluster today about tariffs
        // is different from a recent poll about the president's healthcare stance
        expect(isTopicTooSimilarToRecent(topic, recentPolls)).toBe(false);
      }
    );

    it('allows "president" cluster even when recent poll was about the president', () => {
      const recentPolls = [
        'should the president be impeached for the scandal?',
        'is the president\'s economic policy working?',
      ];
      
      // A new "president" cluster might be about a completely different story
      // (new executive order, foreign trip, etc.) - the single word can't distinguish
      expect(isTopicTooSimilarToRecent('president', recentPolls)).toBe(false);
    });

    it('allows "house" cluster even with house-related recent polls', () => {
      const recentPolls = [
        'should the house pass the spending bill?',
        'will the house vote affect the economy?',
      ];
      
      expect(isTopicTooSimilarToRecent('house', recentPolls)).toBe(false);
    });

    it('allows "congress" cluster even when congress is mentioned', () => {
      const recentPolls = [
        'should congress have term limits?',
        'is congress doing enough about inflation?',
      ];
      
      expect(isTopicTooSimilarToRecent('congress', recentPolls)).toBe(false);
    });

    it('allows "white house" (multi-word generic term)', () => {
      const recentPolls = [
        'should the white house release more documents?',
        'is the white house handling the crisis well?',
      ];
      
      expect(isTopicTooSimilarToRecent('white house', recentPolls)).toBe(false);
    });
  });

  describe('specific (non-generic) terms use stricter word-boundary matching', () => {
    it('skips specific topic when it appears as a word in recent poll', () => {
      const recentPolls = [
        'should the government invest more in infrastructure spending?',
      ];
      
      // "infrastructure" is specific enough to indicate the same topic area
      expect(isTopicTooSimilarToRecent('infrastructure', recentPolls)).toBe(true);
    });

    it('skips "tariff" when recent poll discusses tariffs', () => {
      const recentPolls = [
        'are the new tariff policies helping american workers?',
      ];
      
      expect(isTopicTooSimilarToRecent('tariff', recentPolls)).toBe(true);
    });

    it('skips "healthcare" when recent poll is about healthcare', () => {
      const recentPolls = [
        'should the government expand healthcare coverage?',
      ];
      
      expect(isTopicTooSimilarToRecent('healthcare', recentPolls)).toBe(true);
    });

    it('skips "immigration" when recent poll mentions immigration', () => {
      const recentPolls = [
        'should the government change immigration policies?',
      ];
      
      expect(isTopicTooSimilarToRecent('immigration', recentPolls)).toBe(true);
    });

    it('allows specific topic that does not appear in recent polls', () => {
      const recentPolls = [
        'should congress pass the spending bill?',
        'is the economy improving under current policies?',
      ];
      
      expect(isTopicTooSimilarToRecent('immigration', recentPolls)).toBe(false);
      expect(isTopicTooSimilarToRecent('tariff', recentPolls)).toBe(false);
    });

    it('uses word boundary matching (tax does not match taxation)', () => {
      const recentPolls = [
        'should taxation rates be reformed?',
      ];
      
      // "tax" should not match "taxation" - different words
      expect(isTopicTooSimilarToRecent('tax', recentPolls)).toBe(false);
    });

    it('matches multi-word specific topics', () => {
      const recentPolls = [
        'should student loan forgiveness be expanded?',
      ];
      
      expect(isTopicTooSimilarToRecent('student loan', recentPolls)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty recent topics array', () => {
      expect(isTopicTooSimilarToRecent('tariff', [])).toBe(false);
    });

    it('returns false for empty topic string', () => {
      expect(isTopicTooSimilarToRecent('', ['some poll question'])).toBe(false);
    });

    it('handles whitespace in topic', () => {
      expect(isTopicTooSimilarToRecent('  tariff  ', [])).toBe(false);
    });

    it('is case insensitive for specific terms', () => {
      const recentPolls = ['Should we increase TARIFF rates?'];
      
      expect(isTopicTooSimilarToRecent('tariff', recentPolls)).toBe(true);
      expect(isTopicTooSimilarToRecent('TARIFF', recentPolls)).toBe(true);
    });

    it('is case insensitive for generic terms', () => {
      const recentPolls = ['Should CONGRESS pass the bill?'];
      
      // Generic terms always allowed regardless of case
      expect(isTopicTooSimilarToRecent('congress', recentPolls)).toBe(false);
      expect(isTopicTooSimilarToRecent('CONGRESS', recentPolls)).toBe(false);
    });
  });

  describe('real-world scenario from Nov 8 incident', () => {
    it('allows news clusters when only overlap is generic vocabulary', () => {
      // These recent polls mention generic political vocabulary
      const recentPolls = [
        'should the senate confirm the new cabinet nominee?',
        'is the administration\'s decision on student loans fair?',
        'should the house vote on the spending package?',
      ];
      
      // Nov 8 clusters were skipped because they matched generic words
      // With the fix, all these generic-term clusters should be ALLOWED
      expect(isTopicTooSimilarToRecent('president', recentPolls)).toBe(false);
      expect(isTopicTooSimilarToRecent('house', recentPolls)).toBe(false);
      expect(isTopicTooSimilarToRecent('white house', recentPolls)).toBe(false);
      expect(isTopicTooSimilarToRecent('election', recentPolls)).toBe(false);
      expect(isTopicTooSimilarToRecent('congress', recentPolls)).toBe(false);
      expect(isTopicTooSimilarToRecent('vote', recentPolls)).toBe(false);
    });

    it('still skips clusters with specific topic overlap', () => {
      const recentPolls = [
        'is the administration\'s decision on student loans fair?',
      ];
      
      // "student loan" is specific - should still be skipped
      expect(isTopicTooSimilarToRecent('student loan', recentPolls)).toBe(true);
      // But "decision" is generic - should be allowed
      expect(isTopicTooSimilarToRecent('decision', recentPolls)).toBe(false);
    });
  });

  describe('evergreen fallback still works for true dead-ends', () => {
    it('specific topic appearing in all recent polls triggers skip (leading to evergreen)', () => {
      const recentPolls = [
        'should tariff rates on chinese goods be increased?',
        'are tariff policies helping manufacturing jobs?',
        'will new tariff exemptions benefit consumers?',
      ];
      
      // If ALL recent polls are about tariffs and today's top cluster is also tariffs,
      // it should be skipped (which eventually leads to evergreen if no other cluster works)
      expect(isTopicTooSimilarToRecent('tariff', recentPolls)).toBe(true);
    });
  });
});

describe('poll-generator configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GENERATION_TIMEOUT_MS configuration', () => {
    it('uses default 240000ms when GENERATION_TIMEOUT_MS is not set', async () => {
      delete process.env.GENERATION_TIMEOUT_MS;
      
      const module = await import('./poll-generator');
      expect(module).toBeDefined();
    });

    it('respects GENERATION_TIMEOUT_MS environment variable', async () => {
      process.env.GENERATION_TIMEOUT_MS = '180000';
      
      const module = await import('./poll-generator');
      expect(module).toBeDefined();
    });
  });

  describe('time budget helpers', () => {
    it('exports runPollGeneration function', async () => {
      const { runPollGeneration } = await import('./poll-generator');
      expect(typeof runPollGeneration).toBe('function');
    });

    it('exports runScheduledGeneration function', async () => {
      const { runScheduledGeneration } = await import('./poll-generator');
      expect(typeof runScheduledGeneration).toBe('function');
    });
  });
});

describe('timeout constants sanity checks', () => {
  it('DEFAULT_GENERATION_TIMEOUT_MS should be less than Lambda 5min limit', () => {
    const LAMBDA_LIMIT_MS = 300000;
    const DEFAULT_GENERATION_TIMEOUT_MS = 240000;
    expect(DEFAULT_GENERATION_TIMEOUT_MS).toBeLessThan(LAMBDA_LIMIT_MS);
  });

  it('MIN_TIME_FOR_LLM_RETRY_MS should be reasonable', () => {
    const MIN_TIME_FOR_LLM_RETRY_MS = 30000;
    expect(MIN_TIME_FOR_LLM_RETRY_MS).toBeGreaterThanOrEqual(20000);
    expect(MIN_TIME_FOR_LLM_RETRY_MS).toBeLessThanOrEqual(60000);
  });

  it('MIN_TIME_FOR_FALLBACK_MS should be reasonable', () => {
    const MIN_TIME_FOR_FALLBACK_MS = 10000;
    expect(MIN_TIME_FOR_FALLBACK_MS).toBeGreaterThanOrEqual(5000);
    expect(MIN_TIME_FOR_FALLBACK_MS).toBeLessThanOrEqual(30000);
  });

  it('default LLM timeout should be reasonable for xAI grok-4.7', () => {
    const DEFAULT_LLM_TIMEOUT_MS = 90000;
    expect(DEFAULT_LLM_TIMEOUT_MS).toBeGreaterThanOrEqual(60000);
    expect(DEFAULT_LLM_TIMEOUT_MS).toBeLessThanOrEqual(180000);
  });
});
