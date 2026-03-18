'use client'

import Link from 'next/link'
import { useState } from 'react'
import { deleteBookmark } from '@/app/actions/bookmark'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Bookmark = {
  id: string
  englishText: string
  japaneseTranslation: string
  createdAt: string
}

type Toast = { id: number; text: string; type: 'success' | 'error' }

// ─── Helper ──────────────────────────────────────────────────────────────────

let toastCounter = 0

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BookmarksView({
  initialBookmarks,
}: {
  initialBookmarks: Bookmark[]
}) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  // ─── Toast ───────────────────────────────────────────────────────────────

  const showToast = (text: string, type: Toast['type']) => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, type === 'success' ? 3000 : 5000)
  }

  // ─── Speech ──────────────────────────────────────────────────────────────

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

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    setIsDeleting(true)

    const result = await deleteBookmark({ bookmarkId: deletingId })

    if (result.success) {
      setBookmarks((prev) => prev.filter((b) => b.id !== deletingId))
      showToast('削除しました', 'success')
    } else {
      showToast('削除に失敗しました。再度お試しください。', 'error')
    }

    setIsDeleting(false)
    setDeletingId(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* ページタイトル */}
      <h1 className="text-xl font-bold text-gray-900 mb-6">ブックマーク一覧</h1>

      {/* 空状態 */}
      {bookmarks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              speakingId={speakingId}
              onSpeak={handleSpeak}
              onDelete={() => setDeletingId(bookmark.id)}
            />
          ))}
        </div>
      )}

      {/* 削除確認モーダル */}
      {deletingId && (
        <DeleteModal
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* トースト通知 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-4 py-2 rounded-full text-sm font-medium shadow-lg text-white
              ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}
            `}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BookmarkCard({
  bookmark,
  speakingId,
  onSpeak,
  onDelete,
}: {
  bookmark: Bookmark
  speakingId: string | null
  onSpeak: (text: string, id: string) => void
  onDelete: () => void
}) {
  const isSpeaking = speakingId === bookmark.id

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
      <p className="text-sm font-semibold text-gray-900 leading-relaxed">
        {bookmark.englishText}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
        {bookmark.japaneseTranslation}
      </p>

      <div className="flex items-center justify-end gap-1 mt-3">
        {/* 音声再生ボタン */}
        <button
          onClick={() => onSpeak(bookmark.englishText, bookmark.id)}
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

        {/* 削除ボタン */}
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label="ブックマークを削除"
          title="削除"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      </div>
      <p className="text-gray-700 font-medium mb-1">ブックマークがありません</p>
      <p className="text-gray-400 text-sm mb-6">
        チャット画面で気に入った英語表現を保存しましょう！
      </p>
      <Link
        href="/chat"
        className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 active:scale-95 transition-all"
      >
        チャット画面へ
      </Link>
    </div>
  )
}

function DeleteModal({
  isDeleting,
  onConfirm,
  onCancel,
}: {
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    /* 背景オーバーレイ */
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      {/* モーダル本体（クリックの伝播を止める）*/}
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-gray-900 mb-1">削除確認</h2>
        <p className="text-sm text-gray-500 mb-6">
          このブックマークを削除しますか？
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                削除中...
              </>
            ) : (
              '削除する'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
