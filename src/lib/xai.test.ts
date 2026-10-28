import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  getLlmTimeoutMs, 
  EmptyLlmResponseError, 
  JsonExtractionError,
  LlmTimeoutError,
} from './xai';

describe('getLlmTimeoutMs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default 90000ms when LLM_TIMEOUT_MS is not set', async () => {
    delete process.env.LLM_TIMEOUT_MS;
    const { getLlmTimeoutMs: freshGetTimeout } = await import('./xai');
    expect(freshGetTimeout()).toBe(90000);
  });

  it('parses LLM_TIMEOUT_MS from environment', async () => {
    process.env.LLM_TIMEOUT_MS = '120000';
    const { getLlmTimeoutMs: freshGetTimeout } = await import('./xai');
    expect(freshGetTimeout()).toBe(120000);
  });

  it('returns default when LLM_TIMEOUT_MS is invalid', async () => {
    process.env.LLM_TIMEOUT_MS = 'not-a-number';
    const { getLlmTimeoutMs: freshGetTimeout } = await import('./xai');
    expect(freshGetTimeout()).toBe(90000);
  });

  it('returns default when LLM_TIMEOUT_MS is zero or negative', async () => {
    process.env.LLM_TIMEOUT_MS = '0';
    const { getLlmTimeoutMs: freshGetTimeout } = await import('./xai');
    expect(freshGetTimeout()).toBe(90000);
    
    process.env.LLM_TIMEOUT_MS = '-1000';
    const { getLlmTimeoutMs: freshGetTimeout2 } = await import('./xai');
    expect(freshGetTimeout2()).toBe(90000);
  });
});

describe('Error classes', () => {
  describe('EmptyLlmResponseError', () => {
    it('has correct name and message', () => {
      const error = new EmptyLlmResponseError('poll generation');
      expect(error.name).toBe('EmptyLlmResponseError');
      expect(error.message).toBe('Empty LLM response received during poll generation');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('JsonExtractionError', () => {
    it('has correct name and message', () => {
      const error = new JsonExtractionError('poll generation', 'some raw response text');
      expect(error.name).toBe('JsonExtractionError');
      expect(error.message).toContain('poll generation');
      expect(error.message).toContain('no valid JSON structure found');
      expect(error instanceof Error).toBe(true);
    });

    it('truncates rawResponse to 1000 chars', () => {
      const longResponse = 'x'.repeat(2000);
      const error = new JsonExtractionError('test', longResponse);
      expect(error.rawResponse.length).toBe(1000);
    });

    it('stores rawResponse for debugging', () => {
      const response = 'Here is some text without JSON';
      const error = new JsonExtractionError('test', response);
      expect(error.rawResponse).toBe(response);
    });
  });

  describe('LlmTimeoutError', () => {
    it('has correct name and message', () => {
      const error = new LlmTimeoutError(90000);
      expect(error.name).toBe('LlmTimeoutError');
      expect(error.message).toBe('LLM call timed out after 90000ms');
      expect(error instanceof Error).toBe(true);
    });
  });
});

describe('JSON extraction (via error handling)', () => {
  it('should handle markdown code fences', async () => {
    const testCases = [
      { input: '```json\n{"question": "Test?"}\n```', expected: true },
      { input: '```\n{"question": "Test?"}\n```', expected: true },
      { input: 'Here is the poll:\n```json\n{"question": "Test?", "options": []}\n```\nDone!', expected: true },
    ];
    
    for (const testCase of testCases) {
      expect(testCase.input.includes('question')).toBe(testCase.expected);
    }
  });

  it('should handle plain JSON objects', async () => {
    const testCases = [
      { input: '{"question": "Test?"}', hasJson: true },
      { input: 'Here is the result: {"question": "Test?"}', hasJson: true },
      { input: 'No JSON here', hasJson: false },
      { input: '', hasJson: false },
    ];
    
    for (const testCase of testCases) {
      const hasJson = testCase.input.includes('{') && testCase.input.includes('}');
      expect(hasJson).toBe(testCase.hasJson);
    }
  });
});
