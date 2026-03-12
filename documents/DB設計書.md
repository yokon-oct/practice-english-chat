# DB 設計書：AI チャット英語学習システム

## 1. 概要

本ドキュメントは、AI チャット英語学習システムのデータベース設計を定義する。
データベースには **Supabase Postgres** を使用し、認証は **Supabase Auth** を利用する。

---

## 2. ER 図（概念）

```
auth.users (Supabase管理)
    │
    └── profiles (1:1)
            │
            ├── chat_sessions (1:N)
            │       │
            │       └── messages (1:N)
            │               │
            │               └── suggestion_messages (1:N)
            │                           │
            └── bookmarks (1:N) ←───────┘ (FK, nullable)
```

---

## 3. テーブル定義

### 3.1. `profiles` テーブル

Supabase Auth が管理する `auth.users` を拡張したユーザープロファイルテーブル。

| カラム名       | データ型                     | 制約                                          | 説明                        |
| -------------- | ---------------------------- | --------------------------------------------- | --------------------------- |
| `id`           | `UUID`                       | PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE | Supabase Auth のユーザー ID |
| `display_name` | `TEXT`                       | -                                             | 表示名                      |
| `created_at`   | `TIMESTAMPTZ`                | NOT NULL, DEFAULT `now()`                     | 作成日時                    |
| `updated_at`   | `TIMESTAMPTZ`                | NOT NULL, DEFAULT `now()`                     | 更新日時                    |

**補足:**
- `auth.users` の行が削除された場合、`profiles` の行も CASCADE 削除される。
- Row Level Security (RLS) を有効化し、本人のみ参照・更新可能にする。

---

### 3.2. `chat_sessions` テーブル

ユーザーごとのチャットセッション（会話の単位）を管理するテーブル。

| カラム名     | データ型      | 制約                                         | 説明             |
| ------------ | ------------- | -------------------------------------------- | ---------------- |
| `id`         | `UUID`        | PRIMARY KEY, DEFAULT `gen_random_uuid()`     | セッション ID    |
| `user_id`    | `UUID`        | NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE | セッションオーナーのユーザー ID |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                    | 作成日時         |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                    | 最終更新日時     |

**インデックス:**
- `user_id` に INDEX を付与（ユーザーのセッション一覧取得の高速化）

---

### 3.3. `messages` テーブル

チャットセッション内のメッセージ（ユーザー・AI 双方）を管理するテーブル。

| カラム名     | データ型      | 制約                                              | 説明                                      |
| ------------ | ------------- | ------------------------------------------------- | ----------------------------------------- |
| `id`         | `UUID`        | PRIMARY KEY, DEFAULT `gen_random_uuid()`          | メッセージ ID                             |
| `session_id` | `UUID`        | NOT NULL, REFERENCES chat_sessions(id) ON DELETE CASCADE | 所属するセッション ID                     |
| `role`       | `TEXT`        | NOT NULL, CHECK (`role` IN ('user', 'assistant')) | 送信者の役割（`user` or `assistant`）     |
| `content`    | `TEXT`        | NOT NULL                                          | メッセージ本文（AI の場合は前文テキスト） |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                         | 送信日時                                  |

**インデックス:**
- `session_id` に INDEX を付与（セッション内メッセージ取得の高速化）

---

### 3.4. `suggestion_messages` テーブル

AI がユーザーの入力に対して生成した英語提案メッセージを管理するテーブル。
1 件の `messages`（AI の返信）に対して最大 3 件のレコードが格納される。

| カラム名              | データ型      | 制約                                              | 説明                                                   |
| --------------------- | ------------- | ------------------------------------------------- | ------------------------------------------------------ |
| `id`                  | `UUID`        | PRIMARY KEY, DEFAULT `gen_random_uuid()`          | 提案メッセージ ID                                      |
| `message_id`          | `UUID`        | NOT NULL, REFERENCES messages(id) ON DELETE CASCADE | 親メッセージ ID（`role = 'assistant'` のメッセージ）   |
| `english_text`        | `TEXT`        | NOT NULL                                          | 英語例文                                               |
| `japanese_translation`| `TEXT`        | NOT NULL                                          | 日本語訳                                               |
| `target_language`     | `TEXT`        | NOT NULL, DEFAULT `'en'`                          | 学習対象言語コード（将来の多言語対応を考慮）           |
| `display_order`       | `INTEGER`     | NOT NULL, CHECK (`display_order` BETWEEN 1 AND 3) | 提案の表示順（1〜3）                                   |
| `created_at`          | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                         | 作成日時                                               |

**インデックス:**
- `message_id` に INDEX を付与

---

### 3.5. `bookmarks` テーブル

ユーザーが保存した提案メッセージを管理するテーブル。
提案メッセージが削除された後もデータを保持できるよう、英文と和訳をテーブル内に複製保持する。

| カラム名                | データ型      | 制約                                                       | 説明                                           |
| ----------------------- | ------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `id`                    | `UUID`        | PRIMARY KEY, DEFAULT `gen_random_uuid()`                   | ブックマーク ID                                |
| `user_id`               | `UUID`        | NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE        | ブックマーク登録ユーザーの ID                  |
| `suggestion_message_id` | `UUID`        | REFERENCES suggestion_messages(id) ON DELETE SET NULL      | 元の提案メッセージ ID（削除時に NULL になる）  |
| `english_text`          | `TEXT`        | NOT NULL                                                   | 英語例文（非正規化コピー）                     |
| `japanese_translation`  | `TEXT`        | NOT NULL                                                   | 日本語訳（非正規化コピー）                     |
| `target_language`       | `TEXT`        | NOT NULL, DEFAULT `'en'`                                   | 学習対象言語コード                             |
| `created_at`            | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                                  | ブックマーク登録日時                           |

**インデックス:**
- `user_id` に INDEX を付与（ユーザーのブックマーク一覧取得の高速化）

**ユニーク制約:**
- `(user_id, suggestion_message_id)` に UNIQUE 制約を付与（同一ユーザーが同一提案を重複ブックマークするのを防ぐ）

---

## 4. Row Level Security (RLS) ポリシー

Supabase の RLS を全テーブルに有効化し、認証済みユーザーが自身のデータのみ操作できるように制限する。

| テーブル              | SELECT         | INSERT         | UPDATE         | DELETE         |
| --------------------- | -------------- | -------------- | -------------- | -------------- |
| `profiles`            | 本人のみ       | 本人のみ       | 本人のみ       | 不可           |
| `chat_sessions`       | 本人のみ       | 本人のみ       | 本人のみ       | 本人のみ       |
| `messages`            | 本人のみ       | 本人のみ       | 不可           | 不可           |
| `suggestion_messages` | 本人のみ       | 本人のみ       | 不可           | 不可           |
| `bookmarks`           | 本人のみ       | 本人のみ       | 不可           | 本人のみ       |

---

## 5. DDL（テーブル作成 SQL）

```sql
-- profiles
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: 本人のみ操作可" ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- chat_sessions
CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions: 本人のみ操作可" ON chat_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- messages
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_session_id ON messages(session_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages: 本人のみ参照・挿入可" ON messages
  USING (
    auth.uid() = (
      SELECT user_id FROM chat_sessions WHERE id = messages.session_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM chat_sessions WHERE id = messages.session_id
    )
  );

-- suggestion_messages
CREATE TABLE suggestion_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id            UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  english_text          TEXT NOT NULL,
  japanese_translation  TEXT NOT NULL,
  target_language       TEXT NOT NULL DEFAULT 'en',
  display_order         INTEGER NOT NULL CHECK (display_order BETWEEN 1 AND 3),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suggestion_messages_message_id ON suggestion_messages(message_id);
ALTER TABLE suggestion_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suggestion_messages: 本人のみ参照・挿入可" ON suggestion_messages
  USING (
    auth.uid() = (
      SELECT cs.user_id
      FROM messages m
      JOIN chat_sessions cs ON cs.id = m.session_id
      WHERE m.id = suggestion_messages.message_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT cs.user_id
      FROM messages m
      JOIN chat_sessions cs ON cs.id = m.session_id
      WHERE m.id = suggestion_messages.message_id
    )
  );

-- bookmarks
CREATE TABLE bookmarks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggestion_message_id UUID REFERENCES suggestion_messages(id) ON DELETE SET NULL,
  english_text          TEXT NOT NULL,
  japanese_translation  TEXT NOT NULL,
  target_language       TEXT NOT NULL DEFAULT 'en',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, suggestion_message_id)
);

CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks: 本人のみ操作可" ON bookmarks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 6. 設計上の考慮事項

### 6.1. データの非正規化（bookmarks テーブル）
`bookmarks` テーブルに `english_text` と `japanese_translation` を複製保持しているのは、チャット履歴（`suggestion_messages`）を削除・アーカイブした場合でも、ユーザーのブックマークデータが失われないようにするためである。

### 6.2. 多言語対応への拡張性（RDD 非機能要件）
`suggestion_messages` および `bookmarks` テーブルに `target_language` カラムを設けることで、英語以外の言語学習にも将来的に対応できる設計としている。

### 6.3. Supabase Auth との連携
`profiles` テーブルは `auth.users` の補完として機能し、ユーザー登録時に Supabase の Database Trigger を用いて自動的にレコードを作成することを推奨する。

```sql
-- auth.users 作成時に profiles を自動作成するトリガー
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```
