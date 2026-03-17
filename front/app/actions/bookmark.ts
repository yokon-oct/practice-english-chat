'use server'

import { createClient } from '@/lib/supabase/server'

export type BookmarkResult =
  | { success: true; data: { bookmarkId: string } }
  | { success: false; error: string }

export type DeleteBookmarkResult =
  | { success: true; data: null }
  | { success: false; error: string }

export async function createBookmark(input: {
  suggestionMessageId: string
}): Promise<BookmarkResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: '認証が必要です' }
  }

  // RLS により自分のセッションに紐づく提案のみ取得できる
  const { data: suggestion, error: sugError } = await supabase
    .from('suggestion_messages')
    .select('english_text, japanese_translation, target_language')
    .eq('id', input.suggestionMessageId)
    .single()

  if (sugError || !suggestion) {
    return { success: false, error: '提案メッセージが見つかりません' }
  }

  const { data: bookmark, error: insertError } = await supabase
    .from('bookmarks')
    .insert({
      user_id: user.id,
      suggestion_message_id: input.suggestionMessageId,
      english_text: suggestion.english_text,
      japanese_translation: suggestion.japanese_translation,
      target_language: suggestion.target_language,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: '既にブックマーク済みです' }
    }
    return { success: false, error: insertError.message }
  }

  return { success: true, data: { bookmarkId: bookmark.id } }
}

export async function deleteBookmark(input: {
  bookmarkId: string
}): Promise<DeleteBookmarkResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: '認証が必要です' }
  }

  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', input.bookmarkId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}
