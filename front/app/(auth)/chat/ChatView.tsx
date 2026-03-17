'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { sendMessage } from '@/app/actions/chat'
import { createBookmark, deleteBookmark } from '@/app/actions/bookmark'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Suggestion = {
  id: string
  englishText: string
  japaneseTranslation: string
  displayOrder: number
  isBookmarked: boolean
  bookmarkId: string | null
}

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  suggestions?: Suggestion[]
}

type Props = {
  sessionId: string
  initialMessages: Message[]
}

type Toast = { id: number; text: string; type: 'success' | 'error' }

// ─── Helper ──────────────────────────────────────────────────────────────────

let toastCounter = 0

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ChatView({ sessionId, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isPending, startTransition] = useTransition()
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 新しいメッセージが追加されたら末尾にスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Toast ─────────────────────────────────────────────────────────────────

  const showToast = (text: string, type: Toast['type']) => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, type === 'success' ? 3000 : 5000)
  }

  // ─── Suggestion helpers ────────────────────────────────────────────────────

  const updateSuggestion = (
    messageId: string,
    suggestionId: string,
    patch: Partial<Suggestion>
  ) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id !== messageId
          ? msg
          : {
              ...msg,
              suggestions: msg.suggestions?.map((s) =>
                s.id === suggestionId ? { ...s, ...patch } : s
              ),
            }
      )
    )
  }

  // ─── Send ───────────────────────────────────────────────────────────────────

  const handleSend = () => {
    const content = input.trim()
    if (!content || isPending) return

    const tempId = `temp-${Date.now()}`
    const tempMessage: Message = {
      id: tempId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempMessage])
    setInput('')

    startTransition(async () => {
      const result = await sendMessage({ sessionId, content })

      if (result.success) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          result.data.userMessage,
          result.data.assistantMessage,
        ])
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        showToast(result.error, 'error')
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── Bookmark ──────────────────────────────────────────────────────────────

  const handleBookmarkToggle = async (suggestion: Suggestion, messageId: string) => {
    if (suggestion.isBookmarked && suggestion.bookmarkId) {
      // 楽観的更新（削除）
      updateSuggestion(messageId, suggestion.id, { isBookmarked: false, bookmarkId: null })

      const result = await deleteBookmark({ bookmarkId: suggestion.bookmarkId })
      if (!result.success) {
        updateSuggestion(messageId, suggestion.id, {
          isBookmarked: true,
          bookmarkId: suggestion.bookmarkId,
        })
        showToast('ブックマーク解除に失敗しました', 'error')
      }
    } else {
      // 楽観的更新（追加）
      updateSuggestion(messageId, suggestion.id, { isBookmarked: true, bookmarkId: 'pending' })

      const result = await createBookmark({ suggestionMessageId: suggestion.id })
      if (result.success) {
        updateSuggestion(messageId, suggestion.id, {
          isBookmarked: true,
          bookmarkId: result.data.bookmarkId,
        })
        showToast('ブックマークに保存しました', 'success')
      } else {
        updateSuggestion(messageId, suggestion.id, { isBookmarked: false, bookmarkId: null })
        showToast(result.error, 'error')
      }
    }
  }

  // ─── Speech ────────────────────────────────────────────────────────────────

  const handleSpeak = (text: string, id: string) => {
    if (!window.speechSynthesis) return

    if (speakingId === id) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    utterance.onstart = () => setSpeakingId(id)
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    window.speechSynthesis.speak(utterance)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* チャットコンテナ（固定位置でサイドバー・ヘッダーを考慮）*/}
      <div className="fixed inset-0 md:left-[220px] flex flex-col bg-gray-50">
        {/* モバイルヘッダーのスペーサー */}
        <div className="md:hidden h-12 shrink-0" />

        {/* メッセージ一覧（スクロール可能） */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onBookmarkToggle={handleBookmarkToggle}
              onSpeak={handleSpeak}
              speakingId={speakingId}
              isPending={isPending && msg.id.startsWith('temp-')}
            />
          ))}

          {/* AI 思考中インジケーター */}
          {isPending && (
            <div className="flex items-start gap-2.5">
              <AiAvatar />
              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100">
                <TypingDots />
              </div>
            </div>
          )}

          {/* スクロールアンカー */}
          <div ref={messagesEndRef} />
        </div>

        {/* 入力フッター */}
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 pb-[calc(0.75rem+56px)] md:pb-3">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              maxLength={1000}
              disabled={isPending}
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={isPending || !input.trim()}
              className="w-10 h-10 shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white disabled:opacity-40 hover:bg-blue-700 active:scale-95 transition-all"
              aria-label="送信"
            >
              <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* トースト通知 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-4 py-2 rounded-full text-sm font-medium shadow-lg text-white
              animate-in fade-in slide-in-from-top-2 duration-200
              ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}
            `}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AiAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

function MessageBubble({
  message,
  onBookmarkToggle,
  onSpeak,
  speakingId,
  isPending,
}: {
  message: Message
  onBookmarkToggle: (suggestion: Suggestion, messageId: string) => void
  onSpeak: (text: string, id: string) => void
  speakingId: string | null
  isPending: boolean
}) {
  if (message.role === 'user') {
    return (
      <div className={`flex justify-end ${isPending ? 'opacity-60' : ''}`}>
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-sm shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* AI 前文メッセージ */}
      <div className="flex items-start gap-2.5">
        <AiAvatar />
        <div className="max-w-[75%] bg-white rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-gray-800 shadow-sm border border-gray-100">
          {message.content}
        </div>
      </div>

      {/* 提案メッセージ（最大3件） */}
      {message.suggestions && message.suggestions.length > 0 && (
        <div className="ml-10 space-y-2">
          {message.suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              messageId={message.id}
              onBookmarkToggle={onBookmarkToggle}
              onSpeak={onSpeak}
              speakingId={speakingId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SuggestionCard({
  suggestion,
  messageId,
  onBookmarkToggle,
  onSpeak,
  speakingId,
}: {
  suggestion: Suggestion
  messageId: string
  onBookmarkToggle: (suggestion: Suggestion, messageId: string) => void
  onSpeak: (text: string, id: string) => void
  speakingId: string | null
}) {
  const isSpeaking = speakingId === suggestion.id

  return (
    <div className="bg-white rounded-2xl rounded-tl-none border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-sm font-semibold text-gray-900 leading-relaxed">
        {suggestion.englishText}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
        {suggestion.japaneseTranslation}
      </p>

      <div className="flex items-center justify-end gap-1 mt-2">
        {/* 音声再生ボタン */}
        <button
          onClick={() => onSpeak(suggestion.englishText, suggestion.id)}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center transition-colors
            ${isSpeaking
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }
          `}
          aria-label="音声を再生"
          title="英語を読み上げる"
        >
          {isSpeaking ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 15.536a5 5 0 010-7.072" />
            </svg>
          )}
        </button>

        {/* ブックマークボタン */}
        <button
          onClick={() => onBookmarkToggle(suggestion, messageId)}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center transition-colors
            ${suggestion.isBookmarked
              ? 'text-amber-500 hover:bg-amber-50'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }
          `}
          aria-label={suggestion.isBookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
          title={suggestion.isBookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
        >
          <svg
            className="w-4 h-4"
            fill={suggestion.isBookmarked ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
