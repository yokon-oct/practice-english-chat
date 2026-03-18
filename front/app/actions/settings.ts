'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Result =
  | { success: true }
  | { success: false; error: string }

// ─── 表示名の更新 ──────────────────────────────────────────────────────────

export async function updateDisplayName(displayName: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: '認証が必要です' }

  const trimmed = displayName.trim()

  if (trimmed.length > 50) {
    return { success: false, error: '表示名は 50 文字以内で入力してください' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed || null, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { success: false, error: '更新に失敗しました。再度お試しください。' }

  return { success: true }
}

// ─── パスワードの変更 ──────────────────────────────────────────────────────

export async function updatePassword(input: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: '認証が必要です' }

  if (!input.currentPassword) {
    return { success: false, error: '現在のパスワードを入力してください' }
  }
  if (!input.newPassword || input.newPassword.length < 8) {
    return { success: false, error: 'パスワードは 8 文字以上で入力してください' }
  }
  if (input.newPassword !== input.confirmPassword) {
    return { success: false, error: 'パスワードが一致しません' }
  }

  // 現在のパスワードを検証
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: input.currentPassword,
  })
  if (signInError) {
    return { success: false, error: '現在のパスワードが正しくありません' }
  }

  // パスワードを更新
  const { error } = await supabase.auth.updateUser({ password: input.newPassword })
  if (error) return { success: false, error: 'パスワードの更新に失敗しました。再度お試しください。' }

  return { success: true }
}

// ─── アカウント削除 ────────────────────────────────────────────────────────

export async function deleteAccount(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // profiles を削除（DB の CASCADE により関連データも連鎖削除される）
  await supabase.from('profiles').delete().eq('id', user.id)

  // auth.users からの削除（Supabase Dashboard の SQL Editor で以下を実行する必要あり）:
  // CREATE OR REPLACE FUNCTION delete_user()
  // RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  //   DELETE FROM auth.users WHERE id = auth.uid();
  // $$;
  await supabase.rpc('delete_user').maybeSingle()

  await supabase.auth.signOut()
  redirect('/login')
}
