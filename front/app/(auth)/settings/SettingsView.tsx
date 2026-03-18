'use client'

import { useState, useTransition } from 'react'
import { updateDisplayName, updatePassword, deleteAccount } from '@/app/actions/settings'

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  displayName: string | null
  email: string | null
  hasPassword: boolean
}

type Toast = { id: number; text: string; type: 'success' | 'error' }

let toastCounter = 0

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsView({ displayName, email, hasPassword }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const showToast = (text: string, type: Toast['type']) => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), type === 'success' ? 3000 : 5000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ページタイトル */}
      <h1 className="text-xl font-bold text-gray-900">設定</h1>

      {/* アカウント情報セクション */}
      <AccountSection
        displayName={displayName}
        email={email}
        onSuccess={(msg) => showToast(msg, 'success')}
        onError={(msg) => showToast(msg, 'error')}
      />

      {/* パスワード変更セクション（メール認証ユーザーのみ） */}
      {hasPassword && (
        <PasswordSection
          onSuccess={(msg) => showToast(msg, 'success')}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* 危険ゾーン */}
      <DangerZone onDeleteClick={() => setShowDeleteModal(true)} />

      {/* アカウント削除確認モーダル */}
      {showDeleteModal && (
        <DeleteAccountModal
          onCancel={() => setShowDeleteModal(false)}
          onError={(msg) => {
            setShowDeleteModal(false)
            showToast(msg, 'error')
          }}
        />
      )}

      {/* トースト通知 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-full text-sm font-medium shadow-lg text-white ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Account Section ─────────────────────────────────────────────────────────

function AccountSection({
  displayName: initialName,
  email,
  onSuccess,
  onError,
}: {
  displayName: string | null
  email: string | null
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState(initialName ?? '')
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateDisplayName(name)
      if (result.success) {
        onSuccess('表示名を更新しました')
      } else {
        onError(result.error)
      }
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          アカウント情報
        </h2>
      </div>
      <div className="px-5 py-5 space-y-5">
        {/* 表示名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            表示名
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="表示名を入力"
              className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              onClick={handleSave}
              disabled={isPending}
              className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isPending ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              保存
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">{name.length} / 50 文字</p>
        </div>

        {/* メールアドレス（読み取り専用）*/}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            メールアドレス
            <span className="ml-2 text-xs text-gray-400 font-normal">変更不可</span>
          </label>
          <p className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
            {email ?? '—'}
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Password Section ─────────────────────────────────────────────────────────

function PasswordSection({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updatePassword({ currentPassword, newPassword, confirmPassword })
      if (result.success) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        onSuccess('パスワードを更新しました')
      } else {
        onError(result.error)
      }
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          パスワード変更
        </h2>
      </div>
      <div className="px-5 py-5 space-y-4">
        {/* 現在のパスワード */}
        <PasswordField
          id="current-password"
          label="現在のパスワード"
          value={currentPassword}
          show={showCurrent}
          onChange={setCurrentPassword}
          onToggleShow={() => setShowCurrent((v) => !v)}
          autoComplete="current-password"
        />

        {/* 新しいパスワード */}
        <PasswordField
          id="new-password"
          label="新しいパスワード"
          hint="8 文字以上"
          value={newPassword}
          show={showNew}
          onChange={setNewPassword}
          onToggleShow={() => setShowNew((v) => !v)}
          autoComplete="new-password"
        />

        {/* 新しいパスワード（確認）*/}
        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            新しいパスワード（確認）
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="もう一度入力してください"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          パスワードを変更する
        </button>
      </div>
    </section>
  )
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────

function DangerZone({ onDeleteClick }: { onDeleteClick: () => void }) {
  return (
    <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-red-50">
        <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide">
          危険ゾーン
        </h2>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">⚠️ アカウントを削除する</p>
            <p className="text-xs text-gray-500 mt-0.5">
              この操作は取り消せません
            </p>
          </div>
          <button
            onClick={onDeleteClick}
            className="shrink-0 px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            アカウントを削除する
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

function DeleteAccountModal({
  onCancel,
  onError,
}: {
  onCancel: () => void
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteAccount()
      } catch {
        onError('アカウントの削除に失敗しました。再度お試しください。')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">⚠️</span>
          <h2 className="text-base font-bold text-gray-900">アカウントを削除しますか？</h2>
        </div>
        <p className="text-sm text-gray-500 mb-1">この操作は取り消せません。</p>
        <p className="text-sm text-gray-500 mb-6">
          すべてのブックマークやチャット履歴も削除されます。
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {isPending ? (
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

// ─── Password Field ───────────────────────────────────────────────────────────

function PasswordField({
  id,
  label,
  hint,
  value,
  show,
  onChange,
  onToggleShow,
  autoComplete,
}: {
  id: string
  label: string
  hint?: string
  value: string
  show: boolean
  onChange: (v: string) => void
  onToggleShow: () => void
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {hint && <span className="ml-2 text-xs text-gray-400 font-normal">{hint}</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={show ? 'パスワードを隠す' : 'パスワードを表示'}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
