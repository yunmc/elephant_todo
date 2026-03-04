/**
 * 共享 LLM 调用工具
 * 支持 Gemini（主）+ DeepSeek（备）双供应商 fallback
 * OpenAI-compatible chat completions 格式
 */

export interface LLMOptions {
  systemPrompt: string
  userMessage: string
  temperature?: number    // 默认 0.1
  maxTokens?: number      // 默认 512
  timeoutMs?: number      // 默认 30000
  preferModel?: 'gemini' | 'deepseek'  // 指定优先模型
}

export interface LLMResult {
  content: string         // 清洗后的文本
  model: string           // 实际使用的模型名
  provider: 'gemini' | 'deepseek'
}

/**
 * 调用 LLM（双供应商 fallback）
 * 1. 根据 preferModel 决定优先供应商（默认 gemini）
 * 2. 调用主供应商，超时控制
 * 3. 失败 → 自动切换备用供应商重试
 * 4. 备用也失败 → 抛出错误
 * 自动处理：超时、fallback、<think> 标签清理、R1 reasoning_content
 */
export async function callLLM(options: LLMOptions): Promise<LLMResult> {
  const {
    systemPrompt,
    userMessage,
    temperature = 0.1,
    maxTokens = 512,
    timeoutMs = 30000,
    preferModel,
  } = options

  const config = useRuntimeConfig()
  const geminiApiKey = config.geminiApiKey as string
  const geminiBaseUrl = config.geminiBaseUrl as string
  const geminiModel = config.geminiModel as string
  const deepseekApiKey = config.deepseekApiKey as string
  const deepseekBaseUrl = config.deepseekBaseUrl as string
  const deepseekModel = config.deepseekModel as string

  // 判断可用供应商
  const hasGemini = !!geminiApiKey
  const hasDeepseek = !!deepseekApiKey

  if (!hasGemini && !hasDeepseek) {
    throw createError({ statusCode: 500, message: 'Gemini/DeepSeek API Key 未配置' })
  }

  // 决定优先供应商
  let primary: 'gemini' | 'deepseek'
  if (preferModel) {
    primary = (preferModel === 'gemini' && hasGemini) ? 'gemini'
      : (preferModel === 'deepseek' && hasDeepseek) ? 'deepseek'
      : hasGemini ? 'gemini' : 'deepseek'
  } else {
    primary = hasGemini ? 'gemini' : 'deepseek'
  }

  const backup: 'gemini' | 'deepseek' = primary === 'gemini' ? 'deepseek' : 'gemini'
  const hasBackup = primary === 'gemini' ? hasDeepseek : hasGemini

  function getProviderConfig(provider: 'gemini' | 'deepseek') {
    const isGemini = provider === 'gemini'
    return {
      url: isGemini ? geminiBaseUrl : deepseekBaseUrl,
      apiKey: isGemini ? geminiApiKey : deepseekApiKey,
      model: isGemini ? geminiModel : deepseekModel,
    }
  }

  async function callProvider(provider: 'gemini' | 'deepseek'): Promise<LLMResult> {
    const { url, apiKey, model } = getProviderConfig(provider)

    if (!apiKey) {
      throw new Error(`${provider} API Key 未配置`)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = Date.now()

    try {
      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      })

      const durationMs = Date.now() - startedAt

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        console.error(`[LLM] ${provider} API error ${response.status}:`, body.slice(0, 300))
        throw new Error(`${provider} API error ${response.status}`)
      }

      const result = await response.json() as any
      const usage = result?.usage || null
      if (usage) {
        console.info(`[LLM] ${provider} model=${model} duration=${durationMs}ms tokens=${usage.total_tokens ?? 'n/a'} (prompt=${usage.prompt_tokens ?? 'n/a'}, completion=${usage.completion_tokens ?? 'n/a'})`)
      } else {
        console.info(`[LLM] ${provider} model=${model} duration=${durationMs}ms`)
      }

      const message = result.choices?.[0]?.message
      // R1 模型: reasoning_content 存思考过程，content 存最终答案
      const rawContent = message?.content || ''
      const reasoning = message?.reasoning_content || ''

      if (!rawContent && !reasoning) {
        console.error('[LLM] Empty response, full result:', JSON.stringify(result).slice(0, 500))
        throw new Error('LLM 返回空内容')
      }

      // 清洗 <think> 标签
      const source = rawContent || reasoning
      const cleaned = source.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      return {
        content: cleaned,
        model,
        provider,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  // 尝试主供应商，失败时回退
  try {
    return await callProvider(primary)
  } catch (primaryErr: any) {
    if (!hasBackup) {
      console.error(`[LLM] ${primary} failed, no backup available:`, primaryErr.message)
      throw createError({ statusCode: 502, message: 'LLM 服务调用失败' })
    }

    console.warn(`[LLM] ${primary} failed (${primaryErr.message}), falling back to ${backup}`)

    try {
      return await callProvider(backup)
    } catch (backupErr: any) {
      console.error(`[LLM] ${backup} also failed:`, backupErr.message)
      throw createError({ statusCode: 502, message: 'LLM 服务调用失败' })
    }
  }
}

/**
 * 从 LLM 返回文本中提取 JSON
 * 处理 markdown 代码块、前后杂文等
 */
export function extractJSON<T = any>(text: string): T {
  let cleaned = text.trim()

  // 处理 markdown 代码块
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // 尝试直接解析
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // 尝试从文本中提取第一个 JSON 对象
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T
      } catch {
        // 尝试提取 JSON 数组
      }
    }

    // 尝试提取 JSON 数组
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T
      } catch {
        // fall through
      }
    }

    throw createError({ statusCode: 502, message: 'LLM 返回内容无法解析为 JSON' })
  }
}
