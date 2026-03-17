import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatView, { type Message } from './ChatView'

const INITIAL_MESSAGE = 'こんにちは！今日はどんな英語を学びたいですか？'

export default async function ChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 直近のセッションを取得
  const { data: latestSession } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let sessionId = latestSession?.id

  // セッションがなければ新規作成（初回アクセス時）
  if (!sessionId) {
    const { data: newSession } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (newSession) {
      sessionId = newSession.id

      // 初回 AI メッセージを挿入
      await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: INITIAL_MESSAGE,
      })
    }
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-full p-8 text-center">
        <p className="text-gray-500 text-sm">
          セッションの作成に失敗しました。ページを再読み込みしてください。
        </p>
      </div>
    )
  }

  // メッセージと提案を取得
  const { data: rawMessages } = await supabase
    .from('messages')
    .select(`
      id,
      role,
      content,
      created_at,
      suggestion_messages (
        id,
        english_text,
        japanese_translation,
        display_order
      )
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  // ブックマーク済みの提案 ID と bookmark.id のマッピングを取得
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id, suggestion_message_id')
    .eq('user_id', user.id)

  const bookmarkMap = new Map(
    (bookmarks ?? []).map((b) => [b.suggestion_message_id, b.id])
  )

  // Messages 型に変換
  const messages: Message[] = (rawMessages ?? []).map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    createdAt: msg.created_at,
    suggestions: ((msg.suggestion_messages as {
      id: string
      english_text: string
      japanese_translation: string
      display_order: number
    }[]) ?? [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((s) => ({
        id: s.id,
        englishText: s.english_text,
        japaneseTranslation: s.japanese_translation,
        displayOrder: s.display_order,
        isBookmarked: bookmarkMap.has(s.id),
        bookmarkId: bookmarkMap.get(s.id) ?? null,
      })),
  }))

  return <ChatView sessionId={sessionId} initialMessages={messages} />
}
