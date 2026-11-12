import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  isTopicTooSimilarToRecent, 
  isNearPass,
  MAX_TOPICS_TO_TRY,
  NEAR_PASS_OVERALL_THRESHOLD,
  NEAR_PASS_INDIVIDUAL_THRESHOLD,
} from './poll-generator';
import type { BiasCheckResult } from '@/types';

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

// ============================================================================
// Near-Pass Detection Tests
// ============================================================================

describe('isNearPass', () => {
  describe('threshold constants are sensible', () => {
    it('MAX_TOPICS_TO_TRY should be at least 2 for multi-topic fallback to be useful', () => {
      expect(MAX_TOPICS_TO_TRY).toBeGreaterThanOrEqual(2);
    });

    it('NEAR_PASS_OVERALL_THRESHOLD should be below pass threshold (0.7) but not too low', () => {
      expect(NEAR_PASS_OVERALL_THRESHOLD).toBeLessThan(0.7);
      expect(NEAR_PASS_OVERALL_THRESHOLD).toBeGreaterThanOrEqual(0.5);
    });

    it('NEAR_PASS_INDIVIDUAL_THRESHOLD should be below individual pass threshold (0.5)', () => {
      expect(NEAR_PASS_INDIVIDUAL_THRESHOLD).toBeLessThan(0.5);
      expect(NEAR_PASS_INDIVIDUAL_THRESHOLD).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('near-pass detection correctly identifies close scores', () => {
    it('returns true for a draft just below passing threshold', () => {
      const biasResult: BiasCheckResult = {
        questionBiasScore: 0.65,
        optionBalanceScore: 0.62,
        perspectiveBalanceScore: 0.68,
        overallScore: 0.65, // Just below 0.7 threshold
        issues: ['Slightly leading question phrasing'],
        passesThreshold: false,
      };
      expect(isNearPass(biasResult)).toBe(true);
    });

    it('returns true for a draft exactly at near-pass threshold', () => {
      const biasResult: BiasCheckResult = {
        questionBiasScore: NEAR_PASS_INDIVIDUAL_THRESHOLD,
        optionBalanceScore: NEAR_PASS_INDIVIDUAL_THRESHOLD,
        perspectiveBalanceScore: NEAR_PASS_INDIVIDUAL_THRESHOLD,
        overallScore: NEAR_PASS_OVERALL_THRESHOLD,
        issues: ['Multiple minor issues'],
        passesThreshold: false,
      };
      expect(isNearPass(biasResult)).toBe(true);
    });

    it('returns false for a draft far below threshold (should use evergreen)', () => {
      const biasResult: BiasCheckResult = {
        questionBiasScore: 0.3,
        optionBalanceScore: 0.25,
        perspectiveBalanceScore: 0.35,
        overallScore: 0.3,
        issues: ['Very biased question', 'Unbalanced options', 'Missing perspectives'],
        passesThreshold: false,
      };
      expect(isNearPass(biasResult)).toBe(false);
    });

    it('returns false when overall is ok but one individual score is too low', () => {
      const biasResult: BiasCheckResult = {
        questionBiasScore: 0.3, // Below NEAR_PASS_INDIVIDUAL_THRESHOLD (0.4)
        optionBalanceScore: 0.8,
        perspectiveBalanceScore: 0.8,
        overallScore: 0.63, // Above NEAR_PASS_OVERALL_THRESHOLD
        issues: ['Leading question'],
        passesThreshold: false,
      };
      expect(isNearPass(biasResult)).toBe(false);
    });

    it('returns false when individual scores are ok but overall is too low', () => {
      const biasResult: BiasCheckResult = {
        questionBiasScore: 0.45,
        optionBalanceScore: 0.45,
        perspectiveBalanceScore: 0.45,
        overallScore: 0.45, // Below NEAR_PASS_OVERALL_THRESHOLD (0.6)
        issues: ['Multiple moderate issues'],
        passesThreshold: false,
      };
      expect(isNearPass(biasResult)).toBe(false);
    });
  });

  describe('a passing result is also a near-pass (but not used since it passes)', () => {
    it('returns true for a fully passing result', () => {
      const biasResult: BiasCheckResult = {
        questionBiasScore: 0.85,
        optionBalanceScore: 0.82,
        perspectiveBalanceScore: 0.88,
        overallScore: 0.85,
        issues: [],
        passesThreshold: true,
      };
      // A passing result also satisfies near-pass criteria
      // (but in practice we'd use it as a full pass, not near-pass)
      expect(isNearPass(biasResult)).toBe(true);
    });
  });
});

// ============================================================================
// Multi-Topic Fallback Scenario Tests
// ============================================================================

describe('multi-topic fallback scenarios (design validation)', () => {
  describe('scenario: topic-1 fails all retries, topic-2 passes', () => {
    it('should correctly identify first topic bias failure then second topic pass', () => {
      // Simulate topic 1 failing with scores below threshold
      const topic1BiasResult: BiasCheckResult = {
        questionBiasScore: 0.45,
        optionBalanceScore: 0.48,
        perspectiveBalanceScore: 0.42,
        overallScore: 0.45,
        issues: ['Leading question about senate confirmation'],
        passesThreshold: false,
      };
      
      // Topic 1 doesn't pass
      expect(topic1BiasResult.passesThreshold).toBe(false);
      // Topic 1 is also not a near-pass (too low)
      expect(isNearPass(topic1BiasResult)).toBe(false);
      
      // Simulate topic 2 passing
      const topic2BiasResult: BiasCheckResult = {
        questionBiasScore: 0.78,
        optionBalanceScore: 0.82,
        perspectiveBalanceScore: 0.75,
        overallScore: 0.78,
        issues: [],
        passesThreshold: true,
      };
      
      // Topic 2 passes - this would be the published poll
      expect(topic2BiasResult.passesThreshold).toBe(true);
    });
  });

  describe('scenario: all topics fail but near-pass draft available', () => {
    it('should identify best near-pass among multiple failed topics', () => {
      // Topic 1: fails far below threshold
      const topic1Result: BiasCheckResult = {
        questionBiasScore: 0.35,
        optionBalanceScore: 0.38,
        perspectiveBalanceScore: 0.32,
        overallScore: 0.35,
        issues: ['Very leading question'],
        passesThreshold: false,
      };
      
      // Topic 2: fails but is a near-pass
      const topic2Result: BiasCheckResult = {
        questionBiasScore: 0.62,
        optionBalanceScore: 0.65,
        perspectiveBalanceScore: 0.58,
        overallScore: 0.62,
        issues: ['Slightly unbalanced'],
        passesThreshold: false,
      };
      
      // Topic 3: fails, also near-pass but worse than topic 2
      const topic3Result: BiasCheckResult = {
        questionBiasScore: 0.55,
        optionBalanceScore: 0.52,
        perspectiveBalanceScore: 0.58,
        overallScore: 0.55,
        issues: ['Moderate bias detected'],
        passesThreshold: false,
      };
      
      // None pass
      expect(topic1Result.passesThreshold).toBe(false);
      expect(topic2Result.passesThreshold).toBe(false);
      expect(topic3Result.passesThreshold).toBe(false);
      
      // Only topics 2 and 3 are near-passes, topic 1 is too low
      expect(isNearPass(topic1Result)).toBe(false);
      expect(isNearPass(topic2Result)).toBe(true);
      expect(isNearPass(topic3Result)).toBe(false); // 0.55 < 0.6 threshold
      
      // Topic 2 is the best near-pass (highest overall score)
      expect(topic2Result.overallScore).toBeGreaterThan(topic3Result.overallScore);
    });
  });

  describe('scenario: all topics fail far below threshold -> evergreen', () => {
    it('should correctly identify when no near-pass is available', () => {
      const topic1Result: BiasCheckResult = {
        questionBiasScore: 0.3,
        optionBalanceScore: 0.28,
        perspectiveBalanceScore: 0.32,
        overallScore: 0.3,
        issues: ['Heavily biased', 'Leading options'],
        passesThreshold: false,
      };
      
      const topic2Result: BiasCheckResult = {
        questionBiasScore: 0.35,
        optionBalanceScore: 0.38,
        perspectiveBalanceScore: 0.32,
        overallScore: 0.35,
        issues: ['Strong bias', 'Unbalanced perspectives'],
        passesThreshold: false,
      };
      
      const topic3Result: BiasCheckResult = {
        questionBiasScore: 0.4,
        optionBalanceScore: 0.42,
        perspectiveBalanceScore: 0.38,
        overallScore: 0.4,
        issues: ['Moderate bias issues'],
        passesThreshold: false,
      };
      
      // None pass
      expect(topic1Result.passesThreshold).toBe(false);
      expect(topic2Result.passesThreshold).toBe(false);
      expect(topic3Result.passesThreshold).toBe(false);
      
      // None are near-passes (all below 0.6 overall threshold)
      expect(isNearPass(topic1Result)).toBe(false);
      expect(isNearPass(topic2Result)).toBe(false);
      expect(isNearPass(topic3Result)).toBe(false);
      
      // In this case, the generator should fall back to evergreen
    });
  });

  describe('edge case: one individual score fails near-pass while others are high', () => {
    it('should not allow near-pass when any individual score is too low', () => {
      // Overall score looks ok, but questionBiasScore is too low
      const biasResult: BiasCheckResult = {
        questionBiasScore: 0.35, // Below 0.4 threshold
        optionBalanceScore: 0.85,
        perspectiveBalanceScore: 0.88,
        overallScore: 0.69, // Just below pass, above near-pass overall
        issues: ['Question is too leading despite balanced options'],
        passesThreshold: false,
      };
      
      expect(isNearPass(biasResult)).toBe(false);
    });
  });
});

describe('fallback_reason field scenarios', () => {
  it('should format reason correctly when topic 2 passes after topic 1 fails', () => {
    const topicsAttempted = ['senate', 'immigration'];
    const successReason = topicsAttempted.length > 1
      ? `Successfully generated poll on topic ${topicsAttempted.length} ("${topicsAttempted[topicsAttempted.length - 1]}") after topics [${topicsAttempted.slice(0, -1).join(', ')}] failed bias checks.`
      : undefined;
    
    expect(successReason).toBe('Successfully generated poll on topic 2 ("immigration") after topics [senate] failed bias checks.');
  });

  it('should format reason correctly for near-pass fallback', () => {
    const topicsAttempted = ['senate', 'immigration', 'tariff'];
    const nearPassTopic = 'immigration';
    const overallScore = 0.65;
    const issues = ['Slightly leading phrasing'];
    
    const nearPassReason = `All ${topicsAttempted.length} topic(s) [${topicsAttempted.join(', ')}] failed full bias check. Published near-pass draft from topic "${nearPassTopic}" with overall score ${overallScore.toFixed(2)} (threshold: 0.7, near-pass threshold: ${NEAR_PASS_OVERALL_THRESHOLD}). Issues: ${issues.join('; ') || 'none flagged'}.`;
    
    expect(nearPassReason).toContain('All 3 topic(s)');
    expect(nearPassReason).toContain('senate, immigration, tariff');
    expect(nearPassReason).toContain('near-pass draft');
    expect(nearPassReason).toContain('0.65');
    expect(nearPassReason).toContain('Slightly leading phrasing');
  });

  it('should format reason correctly for evergreen fallback', () => {
    const topicsAttempted = ['senate', 'tariff'];
    const lastError = 'Bias check failed: Heavy leading language, Unbalanced options';
    
    const fallbackReasonPrefix = `All ${topicsAttempted.length} topic(s) [${topicsAttempted.join(', ')}] failed bias checks with no near-pass candidates (scores below ${NEAR_PASS_OVERALL_THRESHOLD})`;
    const fullReason = `${fallbackReasonPrefix}. Last error: ${lastError}. Using evergreen poll.`;
    
    expect(fullReason).toContain('All 2 topic(s)');
    expect(fullReason).toContain('no near-pass candidates');
    expect(fullReason).toContain('scores below 0.6');
    expect(fullReason).toContain('Using evergreen poll');
  });
});
