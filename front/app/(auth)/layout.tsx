import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/app/components/Sidebar'
import BottomNav from '@/app/components/BottomNav'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.display_name ?? null
  const email = user.email ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PC：左固定サイドバー */}
      <Sidebar displayName={displayName} email={email} />

      {/* コンテンツエリア */}
      <div className="md:pl-[220px] min-h-screen flex flex-col">
        {/* モバイル：ヘッダー */}
        <header className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-100">
          <div className="flex items-center justify-center px-4 h-12">
            <Link href="/chat" className="font-bold text-gray-900 text-base">
              English Chat
            </Link>
          </div>
        </header>

        {/* ページコンテンツ */}
        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* モバイル：ボトムナビゲーション */}
      <BottomNav />
    </div>
  )
}
