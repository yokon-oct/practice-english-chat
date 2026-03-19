'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { createNewChatSession } from '@/app/actions/chat'

type Props = {
  displayName: string | null
  email: string | null
}

const bookmarkItem = {
  href: '/bookmarks',
  label: 'ブックマーク',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ),
}

const chatIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

export default function Sidebar({ displayName, email }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const userName = displayName || email?.split('@')[0] || 'ユーザー'
  const avatarInitial = userName.charAt(0).toUpperCase()

  const isChatActive = pathname.startsWith('/chat')
  const isBookmarkActive = pathname.startsWith('/bookmarks')

  // チャットをリセットして新しいセッションを開始
  const handleChatReset = async () => {
    if (isPending) return
    setIsPending(true)
    await createNewChatSession()
    setIsPending(false)
    if (pathname.startsWith('/chat')) {
      router.refresh()
    } else {
      router.push('/chat')
    }
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] hidden md:flex flex-col bg-white border-r border-gray-100 z-20">
      {/* ロゴ・アプリ名 */}
      <button
        onClick={handleChatReset}
        disabled={isPending}
        className="flex items-center gap-2.5 px-4 py-5 hover:opacity-80 transition-opacity text-left"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <span className="font-bold text-gray-900 text-sm">English Chat</span>
      </button>

      <div className="mx-3 border-t border-gray-100" />

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {/* チャット（本体はページ遷移、＋アイコンのみ新規セッション作成） */}
        <div
          className={`
            group flex items-center rounded-lg text-sm font-medium transition-colors relative
            ${isChatActive
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }
          `}
        >
          {isChatActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
          )}
          {/* チャットページへ遷移 */}
          <Link
            href="/chat"
            className="flex-1 flex items-center gap-3 px-3 py-2.5"
          >
            <span className={isChatActive ? 'text-blue-600' : 'text-gray-400'}>
              {chatIcon}
            </span>
            チャット
          </Link>
          {/* 新規チャット作成ボタン（ホバー時のみ表示） */}
          <button
            onClick={handleChatReset}
            disabled={isPending}
            title="新しいチャットを開始"
            className="mr-1 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 disabled:opacity-40"
            aria-label="新しいチャットを開始"
          >
            {isPending ? (
              <svg className="w-3.5 h-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>

        {/* ブックマーク */}
        <Link
          href={bookmarkItem.href}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
            ${isBookmarkActive
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }
          `}
        >
          {isBookmarkActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
          )}
          <span className={isBookmarkActive ? 'text-blue-600' : 'text-gray-400'}>
            {bookmarkItem.icon}
          </span>
          {bookmarkItem.label}
        </Link>
      </nav>

      {/* 下部：ユーザー情報・設定・ログアウト */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-1">
        {/* ユーザー情報 */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-blue-600">{avatarInitial}</span>
          </div>
          <span className="text-sm text-gray-700 font-medium truncate">{userName}</span>
        </div>

        {/* 設定 */}
        <Link
          href="/settings"
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
            ${pathname.startsWith('/settings')
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }
          `}
        >
          {pathname.startsWith('/settings') && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
          )}
          <span className={pathname.startsWith('/settings') ? 'text-blue-600' : 'text-gray-400'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          設定
        </Link>

        {/* ログアウト */}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors group"
          >
            <span className="text-gray-400 group-hover:text-red-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
            ログアウト
          </button>
        </form>
      </div>
    </aside>
  )
}
