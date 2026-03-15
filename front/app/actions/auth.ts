'use server'

import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  error?: string
  success?: boolean
  email?: string
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!email) return { error: 'メールアドレスを入力してください' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: '正しいメールアドレスの形式で入力してください' }
  }
  if (!password) return { error: 'パスワードを入力してください' }
  if (password.length < 8) {
    return { error: 'パスワードは 8 文字以上で入力してください' }
  }
  if (password !== confirmPassword) {
    return { error: 'パスワードが一致しません' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'このメールアドレスは既に使用されています' }
    }
    return { error: 'エラーが発生しました。再度お試しください。' }
  }

  return { success: true, email }
}
