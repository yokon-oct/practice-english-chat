import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsView from './SettingsView'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // プロフィール取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  // ソーシャルログインのみかどうかを判定
  // identities に email プロバイダーが含まれていればパスワードあり
  const hasPassword =
    user.identities?.some((identity) => identity.provider === 'email') ?? false

  return (
    <SettingsView
      displayName={profile?.display_name ?? null}
      email={user.email ?? null}
      hasPassword={hasPassword}
    />
  )
}
