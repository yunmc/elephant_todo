import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 读取 prompts 目录下的合并提示词文件
const promptsDir = resolve(process.cwd(), 'prompts')
const mergedPromptTemplate = readFileSync(resolve(promptsDir, '智能建议提示词.md'), 'utf-8').trim()

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { text } = await readBody<{ text: string }>(event)

  if (!text?.trim()) {
    throw createError({ statusCode: 400, message: '请提供输入文本' })
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

  // 1. 获取用户的分类列表
  const [categoryRows] = await getDb().query<import('mysql2').RowDataPacket[]>(
    'SELECT id, name FROM categories WHERE user_id = ?',
    [userId],
  )
  const categories = categoryRows.map((c: any) => ({ id: c.id, name: c.name }))

  // 2. 获取用户未完成的 todo 列表
  const [todoRows] = await getDb().query<import('mysql2').RowDataPacket[]>(
    'SELECT id, title, description FROM todos WHERE user_id = ? AND status = \'pending\' ORDER BY created_at DESC LIMIT 50',
    [userId],
  )
  const todos = todoRows.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
  }))

  // 构造合并后的 prompt
  const categoriesText = categories.length > 0
    ? categories.map((c: any) => `- id=${c.id}, name="${c.name}"`).join('\n')
    : '（暂无分类）'
  const todosText = todos.length > 0
    ? todos.map((t: any) => `- id=${t.id}, title="${t.title}"${t.description ? `, desc="${t.description}"` : ''}`).join('\n')
    : '（暂无待办）'
  const mergedPrompt = mergedPromptTemplate
    .replace('{{text}}', text)
    .replace('{{categories}}', categoriesText)
    .replace('{{todos}}', todosText)

  async function callLlm(target: 'gemini' | 'deepseek') {
    const isGemini = target === 'gemini'
    const url = isGemini ? baseUrl : deepseekBaseUrl
    const key = isGemini ? apiKey : deepseekApiKey
    const modelName = isGemini ? model : deepseekModel
    const startedAt = Date.now()
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
    })
    const durationMs = Date.now() - startedAt
    return { response, durationMs }
  }

  // 4. 调用 LLM（Gemini 优先，额度不足时回退 DeepSeek）
  try {
    let provider: 'gemini' | 'deepseek' = 'gemini'
    let { response, durationMs } = await callLlm('gemini')
    if (!response.ok) {
      const body = await response.text()
      const isQuota = response.status === 403 && body.includes('insufficient_user_quota')
      if (isQuota && deepseekApiKey) {
        console.warn('[SmartSuggest] Gemini quota不足，回退 DeepSeek')
        provider = 'deepseek'
        const fallback = await callLlm('deepseek')
        response = fallback.response
        durationMs = fallback.durationMs
      } else {
        console.error(`[SmartSuggest] Gemini API error ${response.status}:`, body)
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

    // 5. 解析 JSON（兼容 markdown 代码块和 think 标签）
    let parsed: any
    try {
      // 优先从 content 提取，如果为空则从 reasoning 末尾提取 JSON
      let source = content || reasoning
      // 去掉 <think>...</think> 标签
      let cleaned = source.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      // 去掉 markdown 代码块
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim()
      }
      // 如果还没找到，尝试从整个文本中提取 JSON 对象
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
      // 返回空结果而不是报错
      return {
        success: true,
        data: { similar_todos: [] },
      }
    }

    // 6. 补充相似 todo 的完整信息
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
