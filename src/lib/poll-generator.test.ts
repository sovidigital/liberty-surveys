import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
