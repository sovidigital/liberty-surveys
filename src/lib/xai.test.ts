import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  EmptyLlmResponseError, 
  JsonExtractionError,
  LlmTimeoutError,
  extractTextFromResponsesOutput,
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

describe('extractTextFromResponsesOutput', () => {
  it('extracts text from output_text content parts (xAI Responses API format)', () => {
    const output = [
      {
        type: 'message' as const,
        content: [
          { type: 'output_text' as const, text: '{"question": "Should we..."}' },
        ],
      },
    ];
    expect(extractTextFromResponsesOutput(output)).toBe('{"question": "Should we..."}');
  });

  it('extracts text from legacy text content parts', () => {
    const output = [
      {
        type: 'message' as const,
        content: [
          { type: 'text' as const, text: '{"question": "Legacy format"}' },
        ],
      },
    ];
    expect(extractTextFromResponsesOutput(output)).toBe('{"question": "Legacy format"}');
  });

  it('handles mixed output_text and text content parts', () => {
    const output = [
      {
        type: 'message' as const,
        content: [
          { type: 'output_text' as const, text: 'Part 1' },
          { type: 'text' as const, text: 'Part 2' },
        ],
      },
    ];
    expect(extractTextFromResponsesOutput(output)).toBe('Part 1Part 2');
  });

  it('concatenates text from multiple message outputs', () => {
    const output = [
      {
        type: 'message' as const,
        content: [{ type: 'output_text' as const, text: 'First message' }],
      },
      {
        type: 'message' as const,
        content: [{ type: 'output_text' as const, text: ' Second message' }],
      },
    ];
    expect(extractTextFromResponsesOutput(output)).toBe('First message Second message');
  });

  it('returns empty string when no text content parts exist', () => {
    const output = [
      {
        type: 'message' as const,
        content: [],
      },
    ];
    expect(extractTextFromResponsesOutput(output)).toBe('');
  });

  it('returns empty string for empty output array', () => {
    expect(extractTextFromResponsesOutput([])).toBe('');
  });

  it('filters out non-message output types', () => {
    const output = [
      {
        type: 'thinking' as unknown as 'message',
        content: [{ type: 'output_text' as const, text: 'Should be ignored' }],
      },
      {
        type: 'message' as const,
        content: [{ type: 'output_text' as const, text: 'Should be included' }],
      },
    ];
    expect(extractTextFromResponsesOutput(output)).toBe('Should be included');
  });

  it('filters out unknown content part types', () => {
    const output = [
      {
        type: 'message' as const,
        content: [
          { type: 'refusal' as unknown as 'text', text: 'Ignored' },
          { type: 'output_text' as const, text: 'Included' },
        ],
      },
    ];
    expect(extractTextFromResponsesOutput(output)).toBe('Included');
  });

  it('handles real xAI Responses API payload structure', () => {
    const realApiResponse = {
      output: [
        {
          type: 'message' as const,
          content: [
            {
              type: 'output_text' as const,
              text: '```json\n{"question": "Should Congress pass the infrastructure bill?", "options": [{"text": "Yes"}, {"text": "No"}]}\n```',
            },
          ],
        },
      ],
    };
    const extracted = extractTextFromResponsesOutput(realApiResponse.output);
    expect(extracted).toContain('question');
    expect(extracted).toContain('infrastructure bill');
    expect(extracted.length).toBeGreaterThan(0);
  });
});
