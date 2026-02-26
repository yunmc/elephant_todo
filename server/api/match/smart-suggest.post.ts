import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// 读取 prompts 目录下的提示词文件（带安全检查）
const promptsDir = resolve(process.cwd(), 'prompts')
const promptPath = resolve(promptsDir, '智能建议提示词.md')
let mergedPromptTemplate = ''
try {
  if (existsSync(promptPath)) {
    mergedPromptTemplate = readFileSync(promptPath, 'utf-8').trim()
  } else {
    console.error('[SmartSuggest] 提示词文件不存在:', promptPath)
  }
} catch (err) {
  console.error('[SmartSuggest] 读取提示词文件失败:', err)
}

export default defineEventHandler(async (event) => {
  // Rate limit: 20 requests per 5 minutes per IP
  rateLimit(event, 'smart-suggest', 20, 5 * 60 * 1000)

  const userId = requireAuth(event)
  const { text } = await readBody<{ text: string }>(event)

  if (!text?.trim()) {
    throw createError({ statusCode: 400, message: '请提供输入文本' })
  }
  if (text.length > 500) {
    throw createError({ statusCode: 400, message: '输入文本不能超过 500 字' })
  }
  if (!mergedPromptTemplate) {
    throw createError({ statusCode: 500, message: '智能建议服务未就绪（提示词文件缺失）' })
  }

  const config = useRuntimeConfig()
  const apiKey = config.geminiApiKey as string
  const baseUrl = config.geminiBaseUrl as string
  const model = config.geminiModel as string
  const deepseekApiKey = config.deepseekApiKey as string
  const deepseekBaseUrl = config.deepseekBaseUrl as string
  const deepseekModel = config.deepseekModel as string
  const similarityThreshold = 0.6

  if (!apiKey && !deepseekApiKey) {
    throw createError({ statusCode: 500, message: 'Gemini/DeepSeek API Key 未配置' })
  }

  // 获取用户未完成的 todo 列表
  const [todoRows] = await getDb().query<import('mysql2').RowDataPacket[]>(
    'SELECT id, title, description FROM todos WHERE user_id = ? AND status = \'pending\' ORDER BY created_at DESC LIMIT 50',
    [userId],
  )
  const todos = todoRows.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
  }))

  // 构造 prompt（用户输入加引号防注入）
  const todosText = todos.length > 0
    ? todos.map((t: any) => `- id=${t.id}, title="${t.title}"${t.description ? `, desc="${t.description}"` : ''}`).join('\n')
    : '（暂无待办）'
  const escapedText = text.replace(/"/g, '\\"').replace(/\n/g, ' ')
  const mergedPrompt = mergedPromptTemplate
    .replace('{{text}}', escapedText)
    .replace('{{todos}}', todosText)

  // 确定优先调用的 provider
  const primaryProvider: 'gemini' | 'deepseek' = apiKey ? 'gemini' : 'deepseek'
  const hasBackup = apiKey && deepseekApiKey

  async function callLlm(target: 'gemini' | 'deepseek') {
    const isGemini = target === 'gemini'
    const url = isGemini ? baseUrl : deepseekBaseUrl
    const key = isGemini ? apiKey : deepseekApiKey
    const modelName = isGemini ? model : deepseekModel

    if (!key) {
      throw new Error(`${target} API Key 未配置`)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout
    const startedAt = Date.now()

    try {
      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'user', content: mergedPrompt },
          ],
          temperature: 0.1,
          max_tokens: 512,
        }),
        signal: controller.signal,
      })
      const durationMs = Date.now() - startedAt
      return { response, durationMs }
    } finally {
      clearTimeout(timeout)
    }
  }

  // 调用 LLM（优先可用 provider，失败时回退备用 provider）
  try {
    let provider = primaryProvider
    let { response, durationMs } = await callLlm(primaryProvider).catch(async (err) => {
      // Primary failed (timeout, network error, etc.) — try backup
      if (hasBackup) {
        const backup = primaryProvider === 'gemini' ? 'deepseek' : 'gemini'
        console.warn(`[SmartSuggest] ${primaryProvider} 调用失败 (${err.message})，回退 ${backup}`)
        provider = backup
        return await callLlm(backup)
      }
      throw err
    })

    if (!response.ok) {
      const body = await response.text()
      // Primary returned error — try backup
      if (hasBackup && provider === primaryProvider) {
        const backup = primaryProvider === 'gemini' ? 'deepseek' : 'gemini'
        console.warn(`[SmartSuggest] ${primaryProvider} API error ${response.status}，回退 ${backup}`)
        provider = backup
        const fallback = await callLlm(backup)
        response = fallback.response
        durationMs = fallback.durationMs

        if (!response.ok) {
          const fallbackBody = await response.text()
          console.error(`[SmartSuggest] ${backup} API error ${response.status}:`, fallbackBody)
          throw createError({ statusCode: 502, message: 'LLM 服务调用失败' })
        }
      } else {
        console.error(`[SmartSuggest] ${provider} API error ${response.status}:`, body)
        throw createError({ statusCode: 502, message: 'LLM 服务调用失败' })
      }
    }

    const result = await response.json() as any
    const usage = result?.usage || null
    if (usage) {
      console.info(`[SmartSuggest] ${provider} duration=${durationMs}ms tokens=${usage.total_tokens ?? 'n/a'} (prompt=${usage.prompt_tokens ?? 'n/a'}, completion=${usage.completion_tokens ?? 'n/a'})`)
    } else {
      console.info(`[SmartSuggest] ${provider} duration=${durationMs}ms tokens=n/a`)
    }
    const message = result.choices?.[0]?.message
    // R1 模型: reasoning_content 存思考过程，content 存最终答案
    const content = message?.content || ''
    const reasoning = message?.reasoning_content || ''

    if (!content && !reasoning) {
      console.error('[SmartSuggest] Empty LLM response, full result:', JSON.stringify(result).slice(0, 500))
    }

    // 解析 JSON（兼容 markdown 代码块和 think 标签）
    let parsed: any
    try {
      let source = content || reasoning
      let cleaned = source.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim()
      }
      if (!cleaned || cleaned[0] !== '{') {
        const jsonObjMatch = source.match(/\{[\s\S]*"similar_todos"[\s\S]*\}/)
        if (jsonObjMatch) {
          cleaned = jsonObjMatch[0]
        }
      }
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[SmartSuggest] Failed to parse LLM response.')
      console.error('[SmartSuggest] content:', content.slice(0, 300))
      console.error('[SmartSuggest] reasoning:', reasoning.slice(0, 300))
      return {
        success: true,
        data: { similar_todos: [] },
      }
    }

    // 补充相似 todo 的完整信息
    const rawSimilarTodos = Array.isArray(parsed.similar_todos) ? parsed.similar_todos : []
    const filteredSimilarTodos = rawSimilarTodos.filter((s: any) => Number(s.similarity) >= similarityThreshold)
    const similarTodoIds = filteredSimilarTodos.map((s: any) => s.id)
    const enrichedSimilarTodos = similarTodoIds
      .map((id: number) => {
        const todo = todos.find((t: any) => t.id === id)
        const suggestion = filteredSimilarTodos.find((s: any) => s.id === id)
        if (!todo) return null
        return {
          id: todo.id,
          title: todo.title,
          similarity: Number(suggestion?.similarity) || 0,
          reason: suggestion?.reason || '',
        }
      })
      .filter(Boolean)

    return {
      success: true,
      data: {
        similar_todos: enrichedSimilarTodos,
      },
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('[SmartSuggest] Error:', error)
    throw createError({ statusCode: 500, message: '智能建议服务异常' })
  }
})
