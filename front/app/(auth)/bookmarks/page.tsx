import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BookmarksView, { type Bookmark } from './BookmarksView'

export default async function BookmarksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLS により user_id = auth.uid() のレコードのみ取得される
  const { data: rawBookmarks } = await supabase
    .from('bookmarks')
    .select('id, english_text, japanese_translation, created_at')
    .order('created_at', { ascending: false })

  const bookmarks: Bookmark[] = (rawBookmarks ?? []).map((b) => ({
    id: b.id,
    englishText: b.english_text,
    japaneseTranslation: b.japanese_translation,
    createdAt: b.created_at,
  }))

  return <BookmarksView initialBookmarks={bookmarks} />
}
