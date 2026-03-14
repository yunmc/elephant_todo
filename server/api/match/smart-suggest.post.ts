import { loadPrompt } from '~/server/utils/llm'

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
  const similarityThreshold = 0.6

  // 获取用户未完成的 todo 列表
  const [todoRows] = await getPool().query<import('mysql2').RowDataPacket[]>(
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
  const mergedPrompt = loadPrompt('智能建议提示词.md')
    .replace('{{text}}', escapedText)
    .replace('{{todos}}', todosText)

  try {
    // 使用共享 LLM 工具调用（smart-suggest 使用单条 user message）
    const llmResult = await callLLM({
      systemPrompt: '',
      userMessage: mergedPrompt,
      temperature: 0.1,
      maxTokens: 512,
    })

    // 解析 JSON
    let parsed: any
    try {
      parsed = extractJSON(llmResult.content)
    } catch {
      console.error('[SmartSuggest] Failed to parse LLM response:', llmResult.content.slice(0, 300))
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
