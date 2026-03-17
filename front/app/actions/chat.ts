'use server'

import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'
import { SYSTEM_PROMPT } from '@/lib/ai/prompts'

type AiResponse = {
  message: string
  suggestions: { englishText: string; japaneseTranslation: string }[]
}

export type SendMessageResult =
  | {
      success: true
      data: {
        userMessage: {
          id: string
          role: 'user'
          content: string
          createdAt: string
        }
        assistantMessage: {
          id: string
          role: 'assistant'
          content: string
          createdAt: string
          suggestions: {
            id: string
            englishText: string
            japaneseTranslation: string
            displayOrder: number
            isBookmarked: false
            bookmarkId: null
          }[]
        }
      }
    }
  | { success: false; error: string }

export async function sendMessage(input: {
  sessionId: string
  content: string
}): Promise<SendMessageResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: '認証が必要です' }
  }

  const trimmed = input.content.trim()
  if (!trimmed) return { success: false, error: '入力が空です' }
  if (trimmed.length > 1000) {
    return { success: false, error: '1000文字以内で入力してください' }
  }

  // ユーザーメッセージを保存
  const { data: userMsg, error: userMsgError } = await supabase
    .from('messages')
    .insert({ session_id: input.sessionId, role: 'user', content: trimmed })
    .select()
    .single()

  if (userMsgError || !userMsg) {
    return { success: false, error: 'メッセージの保存に失敗しました' }
  }

  // 会話履歴を取得してコンテキスト構築（最新20件）
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', input.sessionId)
    .order('created_at', { ascending: true })
    .limit(20)

  // Gemini は messages の先頭が必ず user である必要があるため、
  // 初回挨拶（assistant）など先頭の assistant メッセージを除外する
  const allMessages = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  const firstUserIdx = allMessages.findIndex((m) => m.role === 'user')
  const messagesForAI = firstUserIdx >= 0 ? allMessages.slice(firstUserIdx) : allMessages

  // Gemini に問い合わせ
  let parsedResponse: AiResponse
  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      system: SYSTEM_PROMPT,
      messages: messagesForAI,
    })

    // コードブロック記法が混入した場合のクリーニング
    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    parsedResponse = JSON.parse(clean) as AiResponse
  } catch (e) {
    console.error('[sendMessage] AI error:', e)
    return { success: false, error: 'AI との通信に失敗しました。再度お試しください。' }
  }

  // アシスタントメッセージを保存
  const { data: assistantMsg, error: assistantMsgError } = await supabase
    .from('messages')
    .insert({
      session_id: input.sessionId,
      role: 'assistant',
      content: parsedResponse.message,
    })
    .select()
    .single()

  if (assistantMsgError || !assistantMsg) {
    return { success: false, error: 'AI メッセージの保存に失敗しました' }
  }

  // 提案メッセージを保存（最大3件）
  const suggestionsToInsert = parsedResponse.suggestions.slice(0, 3).map((s, i) => ({
    message_id: assistantMsg.id,
    english_text: s.englishText,
    japanese_translation: s.japaneseTranslation,
    display_order: i + 1,
  }))

  const { data: suggestions, error: sugError } = await supabase
    .from('suggestion_messages')
    .insert(suggestionsToInsert)
    .select()

  if (sugError || !suggestions) {
    return { success: false, error: '提案の保存に失敗しました' }
  }

  return {
    success: true,
    data: {
      userMessage: {
        id: userMsg.id,
        role: 'user',
        content: userMsg.content,
        createdAt: userMsg.created_at,
      },
      assistantMessage: {
        id: assistantMsg.id,
        role: 'assistant',
        content: assistantMsg.content,
        createdAt: assistantMsg.created_at,
        suggestions: suggestions
          .sort((a, b) => a.display_order - b.display_order)
          .map((s) => ({
            id: s.id,
            englishText: s.english_text,
            japaneseTranslation: s.japanese_translation,
            displayOrder: s.display_order,
            isBookmarked: false as const,
            bookmarkId: null,
          })),
      },
    },
  }
}
