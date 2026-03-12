# API 設計書：AI チャット英語学習システム

## 1. 概要

本ドキュメントは、AI チャット英語学習システムのサーバーサイド API 設計を定義する。
本システムでは **Supabase** を認証・DB の基盤として採用し、サーバーサイドの処理は **Next.js Server Actions** と **Route Handlers** で実装する。
AI との通信には **Vercel AI SDK** を使用する。

### 処理方式の使い分け

| 方式 | 用途 |
|---|---|
| **Server Component（直接クエリ）** | 読み取り専用のデータ取得（`supabase.from().select()`） |
| **Server Actions** | データ変更・AI 呼び出しなど、副作用を伴う処理 |
| **Route Handlers** | OAuth コールバックなど、外部サービスからのリダイレクト受け取り |
| **Middleware** | 全リクエストでの認証セッション自動更新 |

---

## 2. Supabase クライアント設定

Supabase を Next.js の SSR 環境で使用するため `@supabase/ssr` パッケージを使う。
用途に応じてクライアントを使い分ける。

### 2.1. サーバーサイド用クライアント（Server Actions / Route Handlers / Server Components）

**ファイルパス:** `lib/supabase/server.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### 2.2. クライアントサイド用クライアント（Client Components）

**ファイルパス:** `lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 2.3. 環境変数

```.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 3. Middleware（セッション自動更新）

**ファイルパス:** `middleware.ts`（プロジェクトルート）

全リクエストでセッショントークンを自動更新し、認証状態を維持する。
未認証ユーザーが保護ルートにアクセスした場合はログインページへリダイレクトする。

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // セッションを最新状態に更新（必須）
  const { data: { user } } = await supabase.auth.getUser()

  // 保護ルートへの未認証アクセスをリダイレクト
  const protectedPaths = ['/chat', '/bookmarks']
  const isProtected = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth/callback).*)'],
}
```

---

## 4. 共通仕様

### 4.1. 認証チェック（Server Actions 共通）

Server Actions では `supabase.auth.getUser()` でセッションを検証する。
RLS がデータレベルのアクセス制御を担うため、アプリ側では主にユーザー ID の取得目的で使用する。

```ts
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }
}
```

### 4.2. レスポンス型

全 Server Actions は以下の共通型でレスポンスを返す。

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }
```

### 4.3. Supabase エラーハンドリング

Supabase クライアントから返るエラーは `PostgrestError` 型。
RLS 違反は `code: '42501'`（permission denied）として返る。

```ts
const { data, error } = await supabase.from('bookmarks').insert(...)
if (error) {
  if (error.code === '42501') {
    return { success: false, error: { code: 'FORBIDDEN', message: '操作権限がありません' } }
  }
  if (error.code === '23505') {
    return { success: false, error: { code: 'CONFLICT', message: '既に登録済みです' } }
  }
  return { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }
}
```

### 4.4. エラーコード一覧

| コード             | Supabase / HTTP 相当     | 説明                             |
| ------------------ | ------------------------ | -------------------------------- |
| `UNAUTHORIZED`     | Auth エラー / 401        | 未認証                           |
| `FORBIDDEN`        | RLS 違反 `42501` / 403   | 操作権限なし                     |
| `NOT_FOUND`        | データなし / 404         | 対象リソースが存在しない         |
| `CONFLICT`         | 一意制約違反 `23505` / 409 | 重複（既にブックマーク済みなど） |
| `VALIDATION_ERROR` | 422                      | 入力値バリデーションエラー       |
| `AI_ERROR`         | 502                      | AI エンジンとの通信エラー        |
| `INTERNAL_ERROR`   | DB エラー / 500          | サーバー内部エラー               |

---

## 5. 認証

### 5.1. `signUp` — ユーザー登録（Server Action）

**ファイルパス:** `app/actions/auth.ts`

#### リクエスト

```ts
type SignUpInput = {
  email: string;    // メールアドレス
  password: string; // パスワード（8文字以上）
}
```

#### レスポンス

```ts
type SignUpData = { userId: string }
ActionResult<SignUpData>
```

#### 処理フロー

1. `email`・`password` のバリデーション
2. `supabase.auth.signUp({ email, password })` を実行
3. Supabase の Database Trigger により `profiles` レコードが自動作成される
4. `userId` を返却

```ts
'use server'
import { createClient } from '@/lib/supabase/server'

export async function signUp(input: SignUpInput): Promise<ActionResult<SignUpData>> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  })
  if (error) { /* エラーハンドリング */ }
  return { success: true, data: { userId: data.user!.id } }
}
```

#### エラー

| 条件                       | エラーコード       |
| -------------------------- | ------------------ |
| メール形式が不正           | `VALIDATION_ERROR` |
| パスワードが 8 文字未満    | `VALIDATION_ERROR` |
| メールアドレスが既に登録済 | `CONFLICT`         |

---

### 5.2. `signIn` — メールログイン（Server Action）

**ファイルパス:** `app/actions/auth.ts`

#### リクエスト

```ts
type SignInInput = {
  email: string
  password: string
}
```

#### レスポンス

```ts
type SignInData = { userId: string }
ActionResult<SignInData>
```

#### 処理フロー

1. `supabase.auth.signInWithPassword({ email, password })` を実行
2. `@supabase/ssr` が自動的にセッションを Cookie にセットする
3. `userId` を返却

```ts
'use server'
export async function signIn(input: SignInInput): Promise<ActionResult<SignInData>> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (error) { /* エラーハンドリング */ }
  return { success: true, data: { userId: data.user.id } }
}
```

#### エラー

| 条件                               | エラーコード   |
| ---------------------------------- | -------------- |
| メールアドレスまたはパスワード不一致 | `UNAUTHORIZED` |

---

### 5.3. `signInWithOAuth` — ソーシャルログイン（Server Action + Route Handler）

ソーシャルログインは **Server Action で OAuth URL を生成 → クライアント側でリダイレクト → Route Handler でコード交換** の流れで実装する。

#### Step 1: OAuth URL 生成（Server Action）

**ファイルパス:** `app/actions/auth.ts`

```ts
type OAuthInput = { provider: 'google' | 'github' }
type OAuthData  = { redirectUrl: string }

'use server'
export async function signInWithOAuth(input: OAuthInput): Promise<ActionResult<OAuthData>> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: input.provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })
  if (error || !data.url) { /* エラーハンドリング */ }
  return { success: true, data: { redirectUrl: data.url } }
}
```

#### Step 2: クライアント側でリダイレクト

```ts
// Client Component 側
const result = await signInWithOAuth({ provider: 'google' })
if (result.success) {
  window.location.href = result.data.redirectUrl
}
```

#### Step 3: OAuth コールバック（Route Handler）

**ファイルパス:** `app/auth/callback/route.ts`

OAuth プロバイダーから返された認可コードをセッショントークンに交換する。

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/chat'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // エラー時はログインページへ
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
```

---

### 5.4. `signOut` — ログアウト（Server Action）

**ファイルパス:** `app/actions/auth.ts`

#### 処理フロー

1. `supabase.auth.signOut()` を実行
2. `@supabase/ssr` が自動的に Cookie のセッションを削除する

```ts
'use server'
export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) { /* エラーハンドリング */ }
  return { success: true, data: null }
}
```

---

## 6. チャット

### 6.1. `createChatSession` — セッション作成（Server Action）

**ファイルパス:** `app/actions/chat.ts`  
**関連機能:** F-01（初期表示）

#### リクエスト

なし

#### レスポンス

```ts
type CreateChatSessionData = {
  session: { id: string; createdAt: string }
  initialMessage: { id: string; role: 'assistant'; content: string; createdAt: string }
}
ActionResult<CreateChatSessionData>
```

#### 処理フロー

1. 認証チェック（`supabase.auth.getUser()`）
2. `chat_sessions` テーブルに INSERT（`user_id` は `user.id`）
3. 初回 AI メッセージを `messages` テーブルに INSERT（`role = 'assistant'`）
4. RLS により `user_id` と `auth.uid()` が一致する場合のみ INSERT が成功する

```ts
'use server'
export async function createChatSession(): Promise<ActionResult<CreateChatSessionData>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }

  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .insert({ user_id: user.id })
    .select()
    .single()
  if (sessionError) { /* エラーハンドリング */ }

  const INITIAL_MESSAGE = 'こんにちは！今日はどんな英語を学びたいですか？'
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({ session_id: session.id, role: 'assistant', content: INITIAL_MESSAGE })
    .select()
    .single()
  if (msgError) { /* エラーハンドリング */ }

  return {
    success: true,
    data: {
      session: { id: session.id, createdAt: session.created_at },
      initialMessage: { id: message.id, role: 'assistant', content: message.content, createdAt: message.created_at },
    },
  }
}
```

#### エラー

| 条件      | エラーコード     |
| --------- | ---------------- |
| 未認証    | `UNAUTHORIZED`   |
| DB エラー | `INTERNAL_ERROR` |

---

### 6.2. チャットセッション取得（Server Component 直接クエリ）

セッションとメッセージ履歴の取得は、副作用のない読み取り処理のため **Server Component から Supabase クライアントを直接呼び出す**形式を採用する。Server Action にする必要はない。

**関連機能:** F-01（初期表示）

```ts
// app/chat/[sessionId]/page.tsx（Server Component）
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ChatPage({ params }: { params: { sessionId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // chat_sessions を取得（RLS により本人のセッションのみ取得可能）
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .single()

  if (!session) redirect('/chat') // 存在しない or 他人のセッション → リダイレクト

  // messages と suggestion_messages を結合取得
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      suggestion_messages (
        id,
        english_text,
        japanese_translation,
        display_order
      )
    `)
    .eq('session_id', params.sessionId)
    .order('created_at', { ascending: true })

  // ブックマーク済みの suggestion_message_id 一覧を取得
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('suggestion_message_id')
    .eq('user_id', user.id)

  const bookmarkedIds = new Set(bookmarks?.map(b => b.suggestion_message_id))

  // ... render
}
```

**取得データ構造:**

```ts
type Suggestion = {
  id: string
  englishText: string
  japaneseTranslation: string
  displayOrder: number
  isBookmarked: boolean
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  suggestions?: Suggestion[] // role = 'assistant' の場合のみ
}
```

---

### 6.3. `sendMessage` — メッセージ送信 & AI 提案生成（Server Action）

**ファイルパス:** `app/actions/chat.ts`  
**関連機能:** F-02（ユーザー入力）、F-03（AI からの提案）

#### リクエスト

```ts
type SendMessageInput = {
  sessionId: string
  content: string // 最大 1000 文字
}
```

#### レスポンス

Vercel AI SDK の `streamText` を利用してレスポンスをストリーミングで返す。
ストリーム完了後に Supabase へ保存する。

```ts
type SendMessageData = {
  userMessage:      { id: string; role: 'user';      content: string; createdAt: string }
  assistantMessage: { id: string; role: 'assistant'; content: string; createdAt: string }
  suggestions: {
    id: string
    englishText: string
    japaneseTranslation: string
    displayOrder: number  // 1〜3
    isBookmarked: false   // 新規生成のため常に false
  }[]
}
ActionResult<SendMessageData>
```

#### 処理フロー

```
1. 認証チェック（supabase.auth.getUser()）
2. content のバリデーション（空文字・1000文字超 を弾く）
3. ユーザーメッセージを messages テーブルに INSERT
   └─ RLS により session_id が自分のセッションでない場合は自動で弾かれる
4. 過去メッセージを SELECT してコンテキストを構築
5. Vercel AI SDK の streamText で LLM にリクエスト（システムプロンプト付き）
6. ストリームをクライアントへ流す
7. ストリーム完了後:
   a. assistant メッセージを messages テーブルに INSERT
   b. 3件の提案を suggestion_messages テーブルに INSERT
8. 保存したデータを返却
```

```ts
'use server'
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google' // LLM プロバイダー例

export async function sendMessage(input: SendMessageInput): Promise<ActionResult<SendMessageData>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }

  if (!input.content.trim()) return { success: false, error: { code: 'VALIDATION_ERROR', message: '入力が空です' } }
  if (input.content.length > 1000) return { success: false, error: { code: 'VALIDATION_ERROR', message: '1000文字以内で入力してください' } }

  // ユーザーメッセージを保存（RLS が session_id の所有者を自動検証）
  const { data: userMsg, error: userMsgError } = await supabase
    .from('messages')
    .insert({ session_id: input.sessionId, role: 'user', content: input.content })
    .select()
    .single()
  if (userMsgError) { /* エラーハンドリング */ }

  // 過去のメッセージを取得してコンテキスト構築
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', input.sessionId)
    .order('created_at', { ascending: true })

  // AI 呼び出し（ストリーミング）
  const google = createGoogleGenerativeAI()
  const { textStream, text } = await streamText({
    model: google('gemini-1.5-pro'),
    system: SYSTEM_PROMPT,
    messages: history?.map(m => ({ role: m.role, content: m.content })) ?? [],
  })

  // ストリームをクライアントへ流す処理（省略）

  // ストリーム完了後に DB 保存
  const parsed = JSON.parse(await text) // AI レスポンスを JSON パース
  const { data: assistantMsg } = await supabase
    .from('messages')
    .insert({ session_id: input.sessionId, role: 'assistant', content: parsed.message })
    .select()
    .single()

  const { data: suggestions } = await supabase
    .from('suggestion_messages')
    .insert(
      parsed.suggestions.map((s: any, i: number) => ({
        message_id: assistantMsg!.id,
        english_text: s.englishText,
        japanese_translation: s.japaneseTranslation,
        display_order: i + 1,
      }))
    )
    .select()

  return { success: true, data: { userMessage: userMsg, assistantMessage: assistantMsg!, suggestions: suggestions! } }
}
```

#### AI プロンプト設計

**ファイルパス:** `lib/ai/prompts.ts`

```ts
export const SYSTEM_PROMPT = `
あなたは英語学習を支援するAIアシスタントです。
ユーザーのリクエストに基づいて、実用的な英語表現を3つ提案してください。
必ず以下のJSON形式のみで回答し、それ以外のテキストは含めないでください:
{
  "message": "前文テキスト（例: 以下の3つの表現を提案します）",
  "suggestions": [
    { "englishText": "英語例文", "japaneseTranslation": "日本語訳" },
    { "englishText": "英語例文", "japaneseTranslation": "日本語訳" },
    { "englishText": "英語例文", "japaneseTranslation": "日本語訳" }
  ]
}
`
```

#### エラー

| 条件                      | エラーコード       |
| ------------------------- | ------------------ |
| 未認証                    | `UNAUTHORIZED`     |
| content が空              | `VALIDATION_ERROR` |
| content が 1000 文字超    | `VALIDATION_ERROR` |
| 他人のセッションへの書込み | `FORBIDDEN`（RLS）|
| AI エンジンとの通信失敗   | `AI_ERROR`         |

---

## 7. ブックマーク

### 7.1. ブックマーク一覧取得（Server Component 直接クエリ）

読み取りのみのため、Server Component から直接クエリする。

**関連機能:** F-06（ブックマーク一覧表示）

```ts
// app/bookmarks/page.tsx（Server Component）
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function BookmarksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS により user_id = auth.uid() のレコードのみ取得される
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id, suggestion_message_id, english_text, japanese_translation, created_at')
    .order('created_at', { ascending: false })

  // ... render
}
```

**取得データ構造:**

```ts
type Bookmark = {
  id: string
  suggestionMessageId: string | null // 元の提案が削除された場合は null
  englishText: string
  japaneseTranslation: string
  createdAt: string
}
```

---

### 7.2. `createBookmark` — ブックマーク登録（Server Action）

**ファイルパス:** `app/actions/bookmark.ts`  
**関連機能:** F-05（ブックマーク登録機能）

#### リクエスト

```ts
type CreateBookmarkInput = {
  suggestionMessageId: string
}
```

#### レスポンス

```ts
type CreateBookmarkData = {
  bookmark: {
    id: string
    suggestionMessageId: string
    englishText: string
    japaneseTranslation: string
    createdAt: string
  }
}
ActionResult<CreateBookmarkData>
```

#### 処理フロー

1. 認証チェック（`supabase.auth.getUser()`）
2. `suggestion_messages` から対象レコードを SELECT（RLS により本人のセッションに紐づくもののみ取得可）
3. `bookmarks` テーブルに INSERT
   - `english_text` と `japanese_translation` は `suggestion_messages` からコピー（非正規化）
   - 重複時は Postgres の一意制約 `23505` エラーが返る

```ts
'use server'
export async function createBookmark(input: CreateBookmarkInput): Promise<ActionResult<CreateBookmarkData>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }

  // RLS により自分のセッションに紐づく提案のみ取得できる
  const { data: suggestion, error: sugError } = await supabase
    .from('suggestion_messages')
    .select('english_text, japanese_translation, target_language')
    .eq('id', input.suggestionMessageId)
    .single()
  if (sugError || !suggestion) return { success: false, error: { code: 'NOT_FOUND', message: '提案メッセージが見つかりません' } }

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
    if (insertError.code === '23505') return { success: false, error: { code: 'CONFLICT', message: '既にブックマーク済みです' } }
    return { success: false, error: { code: 'INTERNAL_ERROR', message: insertError.message } }
  }

  return { success: true, data: { bookmark: { id: bookmark.id, suggestionMessageId: bookmark.suggestion_message_id, englishText: bookmark.english_text, japaneseTranslation: bookmark.japanese_translation, createdAt: bookmark.created_at } } }
}
```

#### エラー

| 条件                             | エラーコード       |
| -------------------------------- | ------------------ |
| 未認証                           | `UNAUTHORIZED`     |
| 提案メッセージが存在しない       | `NOT_FOUND`        |
| 他人の提案メッセージへのアクセス | `NOT_FOUND`（RLS により取得できないため） |
| 既にブックマーク済み             | `CONFLICT`         |

---

### 7.3. `deleteBookmark` — ブックマーク削除（Server Action）

**ファイルパス:** `app/actions/bookmark.ts`  
**関連機能:** F-08（ブックマーク削除）

#### リクエスト

```ts
type DeleteBookmarkInput = {
  bookmarkId: string
}
```

#### レスポンス

```ts
type DeleteBookmarkData = { deletedId: string }
ActionResult<DeleteBookmarkData>
```

#### 処理フロー

1. 認証チェック
2. `bookmarks` テーブルから対象レコードを DELETE
   - `WHERE id = bookmarkId AND user_id = user.id` の条件を指定
   - RLS + WHERE 句の二重チェックにより、他人のブックマークは削除不可
3. 削除件数が 0 の場合は `NOT_FOUND` を返却

```ts
'use server'
export async function deleteBookmark(input: DeleteBookmarkInput): Promise<ActionResult<DeleteBookmarkData>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }

  const { data, error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', input.bookmarkId)
    .eq('user_id', user.id) // RLS に加えてアプリレベルでも user_id を絞り込む
    .select()

  if (error) return { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }
  if (!data || data.length === 0) return { success: false, error: { code: 'NOT_FOUND', message: 'ブックマークが見つかりません' } }

  return { success: true, data: { deletedId: input.bookmarkId } }
}
```

#### エラー

| 条件                           | エラーコード     |
| ------------------------------ | ---------------- |
| 未認証                         | `UNAUTHORIZED`   |
| ブックマークが存在しない       | `NOT_FOUND`      |
| 他人のブックマークを指定       | `NOT_FOUND`（RLS + WHERE 句で取得できないため） |

---

## 8. ファイル構成

```
/
├── middleware.ts                        # セッション自動更新・保護ルートのリダイレクト
│
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                # OAuth コールバック Route Handler
│   ├── actions/
│   │   ├── auth.ts                     # signUp, signIn, signInWithOAuth, signOut
│   │   ├── chat.ts                     # createChatSession, sendMessage
│   │   └── bookmark.ts                 # createBookmark, deleteBookmark
│   ├── chat/
│   │   └── [sessionId]/
│   │       └── page.tsx                # チャット画面（Server Component、直接クエリ）
│   └── bookmarks/
│       └── page.tsx                    # ブックマーク一覧（Server Component、直接クエリ）
│
└── lib/
    ├── supabase/
    │   ├── server.ts                   # サーバーサイド用 Supabase クライアント
    │   └── client.ts                   # クライアントサイド用 Supabase クライアント
    └── ai/
        └── prompts.ts                  # AI システムプロンプト
```

---

## 9. シーケンス図

### 9.1. メールログインフロー

```
Client (Browser)       Server Action (signIn)     Supabase Auth      Cookie
      │                        │                        │               │
      │── signIn(input) ──────>│                        │               │
      │                        │── signInWithPassword ─>│               │
      │                        │<── session ────────────│               │
      │                        │── setAll(cookies) ─────────────────────>│
      │<── ActionResult ────────│                        │               │
```

### 9.2. ソーシャルログインフロー

```
Client (Browser)  Server Action (signInWithOAuth)  OAuth Provider  Route Handler (/auth/callback)  Supabase Auth
      │                    │                             │                   │                          │
      │── signInWithOAuth ─>│                            │                   │                          │
      │                    │── signInWithOAuth() ──────────────────────────────────────────────────>│
      │                    │<── { url } ───────────────────────────────────────────────────────────│
      │<── { redirectUrl } ─│                            │                   │                          │
      │── location.href ───────────────────────────────>│                   │                          │
      │<── redirect to /auth/callback?code=xxx ─────────│                   │                          │
      │                                                  │── GET /auth/callback?code=xxx ───────────>│  │
      │                                                  │              │── exchangeCodeForSession ────>│
      │                                                  │              │<── session ──────────────────│
      │<──────────────────────────────────────────────────── redirect to /chat ──────────────────────│
```

### 9.3. チャット送信フロー（F-02 / F-03）

```
Client         Server Action (sendMessage)        Supabase DB          Vercel AI SDK (LLM)
  │                      │                             │                       │
  │── sendMessage ───────>│                            │                       │
  │                      │── getUser() ───────────────>│                       │
  │                      │<── user ────────────────────│                       │
  │                      │── INSERT user message ──────>│                      │
  │                      │── SELECT 過去メッセージ ─────>│                      │
  │                      │<── messages[] ──────────────│                       │
  │                      │── streamText(prompt) ────────────────────────────>│
  │<── stream chunk ──────│<── stream chunk ────────────────────────────────│
  │<── stream chunk ──────│<── stream 完了 ─────────────────────────────────│
  │                      │── INSERT assistant message ──>│                     │
  │                      │── INSERT suggestion_messages ─>│                    │
  │<── ActionResult ──────│                             │                       │
```

### 9.4. ブックマーク登録フロー（F-05）

```
Client         Server Action (createBookmark)     Supabase DB（RLS 適用済み）
  │                      │                             │
  │── createBookmark ────>│                            │
  │                      │── getUser() ───────────────>│
  │                      │<── user ────────────────────│
  │                      │── SELECT suggestion_messages ──>│  ← RLS: 本人のセッションのみ取得可
  │                      │<── suggestion ──────────────│
  │                      │── INSERT bookmarks ─────────>│  ← RLS: user_id = auth.uid() のみ挿入可
  │                      │<── bookmark ────────────────│
  │<── ActionResult ──────│                            │
```

---

## 10. 設計上の考慮事項

### 10.1. RLS による権限制御の一元化
Supabase の RLS ポリシーをセキュリティの主要な防壁として機能させる。アプリケーションコードでは `user_id` を WHERE 句に指定することで二重チェックとしているが、万一アプリのコードに不備があっても RLS がデータを保護する。

### 10.2. 読み取り処理は Server Component 直接クエリ
`getChatSession`・`getBookmarks` のような副作用のない読み取り処理は、Server Action を経由せず Server Component から Supabase クライアントを直接呼び出す。不要なラッパーを減らし、コードをシンプルに保つ。

### 10.3. `@supabase/ssr` の Cookie 管理
`@supabase/ssr` を使用することで、JWTトークンの Cookie への読み書きを自動化できる。`middleware.ts` でセッションを常に最新に保つことが必須であり、これを省略するとトークン更新が機能しない。

### 10.4. OAuth コールバックの Route Handler
ソーシャルログインの認可コード交換（`exchangeCodeForSession`）は Server Action ではなく Route Handler で行う。外部 OAuth プロバイダーからのリダイレクトを受け取る必要があるため、URL として公開できる Route Handler が適切である。

### 10.5. ストリーミング対応（sendMessage）
`sendMessage` は Vercel AI SDK の `streamText` を使用することで、AI からの返答をリアルタイムで表示できる。RDD のパフォーマンス要件（5 秒以内の応答表示）を満たすために、ストリーミングによる逐次表示を採用する。

### 10.6. ブックマークの非正規化保存
`createBookmark` 時に `english_text` と `japanese_translation` を `bookmarks` テーブルに複製保存する。チャット履歴（`suggestion_messages`）が削除されてもブックマークデータが失われないようにするため。

### 10.7. 将来の多言語対応
`sendMessage` の `SYSTEM_PROMPT` に `target_language` パラメータを渡せるよう拡張することで、英語以外の言語学習にも対応できる。
