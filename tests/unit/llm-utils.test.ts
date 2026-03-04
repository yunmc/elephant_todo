/**
 * LLM Utils — Unit Tests
 *
 * Tests for callLLM and extractJSON utility functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ══════════════════════════════════════════════════════════════
// extractJSON
// ══════════════════════════════════════════════════════════════

describe('extractJSON', () => {
  let extractJSONFn: typeof import('../../server/utils/llm').extractJSON

  beforeEach(async () => {
    // Re-import to get real implementation
    vi.stubGlobal('useRuntimeConfig', () => ({
      geminiApiKey: 'test-key',
      geminiBaseUrl: 'https://api.test.com/v1',
      geminiModel: 'test-model',
      deepseekApiKey: 'test-key2',
      deepseekBaseUrl: 'https://api2.test.com/v1',
      deepseekModel: 'test-model2',
    }))
    const mod = await import('../../server/utils/llm')
    extractJSONFn = mod.extractJSON
  })

  it('should parse plain JSON object', () => {
    const result = extractJSONFn('{"amount": 38, "type": "expense"}')
    expect(result).toEqual({ amount: 38, type: 'expense' })
  })

  it('should parse JSON from markdown code block', () => {
    const text = '```json\n{"amount": 42}\n```'
    const result = extractJSONFn(text)
    expect(result).toEqual({ amount: 42 })
  })

  it('should parse JSON from bare code block', () => {
    const text = '```\n{"key": "value"}\n```'
    const result = extractJSONFn(text)
    expect(result).toEqual({ key: 'value' })
  })

  it('should extract JSON object from mixed text', () => {
    const text = 'Here is the result:\n{"amount": 10}\nEnd of response.'
    const result = extractJSONFn(text)
    expect(result).toEqual({ amount: 10 })
  })

  it('should extract JSON array', () => {
    const text = 'Results: [1, 2, 3]'
    const result = extractJSONFn(text)
    expect(result).toEqual([1, 2, 3])
  })

  it('should throw on non-JSON text', () => {
    expect(() => extractJSONFn('This is just plain text')).toThrow()
  })

  it('should handle whitespace around JSON', () => {
    const result = extractJSONFn('  \n  {"a": 1}  \n  ')
    expect(result).toEqual({ a: 1 })
  })

  it('should handle nested JSON objects', () => {
    const text = '{"outer": {"inner": true}}'
    const result = extractJSONFn(text)
    expect(result).toEqual({ outer: { inner: true } })
  })
})

// ══════════════════════════════════════════════════════════════
// callLLM
// ══════════════════════════════════════════════════════════════

describe('callLLM', () => {
  let callLLMFn: typeof import('../../server/utils/llm').callLLM

  beforeEach(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      geminiApiKey: 'gemini-key',
      geminiBaseUrl: 'https://gemini.test/v1',
      geminiModel: 'gemini-pro',
      deepseekApiKey: 'deepseek-key',
      deepseekBaseUrl: 'https://deepseek.test/v1',
      deepseekModel: 'deepseek-v3',
    }))
    const mod = await import('../../server/utils/llm')
    callLLMFn = mod.callLLM
  })

  it('should throw 500 if no API keys configured', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      geminiApiKey: '',
      geminiBaseUrl: '',
      geminiModel: '',
      deepseekApiKey: '',
      deepseekBaseUrl: '',
      deepseekModel: '',
    }))
    // Re-import to use new config
    const mod = await import('../../server/utils/llm')

    try {
      await mod.callLLM({
        systemPrompt: 'test',
        userMessage: 'test',
      })
      expect.unreachable('should have thrown')
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })

  it('should call gemini by default and return content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"result": true}' } }],
        usage: { total_tokens: 100, prompt_tokens: 80, completion_tokens: 20 },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callLLMFn({
      systemPrompt: 'You are helpful',
      userMessage: 'Hello',
    })

    expect(result.content).toBe('{"result": true}')
    expect(result.provider).toBe('gemini')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://gemini.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('should fallback to deepseek on gemini failure', async () => {
    let callCount = 0
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      callCount++
      if (url.includes('gemini')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'backup response' } }],
        }),
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callLLMFn({
      systemPrompt: 'test',
      userMessage: 'test',
    })

    expect(result.provider).toBe('deepseek')
    expect(result.content).toBe('backup response')
    expect(callCount).toBe(2)
  })

  it('should prefer deepseek when specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'deepseek result' } }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callLLMFn({
      systemPrompt: 'test',
      userMessage: 'test',
      preferModel: 'deepseek',
    })

    expect(result.provider).toBe('deepseek')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://deepseek.test/v1/chat/completions',
      expect.any(Object),
    )
  })

  it('should clean <think> tags from response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '<think>thinking...</think>actual content' } }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callLLMFn({
      systemPrompt: 'test',
      userMessage: 'test',
    })

    expect(result.content).toBe('actual content')
  })

  it('should handle R1 reasoning_content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '', reasoning_content: 'reasoning result' } }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await callLLMFn({
      systemPrompt: 'test',
      userMessage: 'test',
    })

    expect(result.content).toBe('reasoning result')
  })

  it('should throw 502 when both providers fail', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('error'),
    })
    vi.stubGlobal('fetch', mockFetch)

    try {
      await callLLMFn({
        systemPrompt: 'test',
        userMessage: 'test',
      })
      expect.unreachable('should have thrown')
    } catch (e: any) {
      expect(e.statusCode).toBe(502)
    }
  })
})
