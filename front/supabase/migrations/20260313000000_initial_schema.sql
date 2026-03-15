-- ============================================================
-- AI チャット英語学習システム：初期スキーマ
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- auth.users を拡張したユーザープロファイル
-- auth.users 登録時にトリガーで自動作成される
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: 本人のみ操作可" ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

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

-- ------------------------------------------------------------
-- chat_sessions
-- ユーザーごとのチャットセッション
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
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

-- ------------------------------------------------------------
-- messages
-- チャットセッション内のメッセージ（ユーザー・AI 双方）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
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

-- ------------------------------------------------------------
-- suggestion_messages
-- AI が生成した英語提案メッセージ（1返信につき最大3件）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suggestion_messages (
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

-- ------------------------------------------------------------
-- bookmarks
-- ユーザーが保存したブックマーク
-- 提案メッセージが削除されてもデータを保持するため英文・和訳を複製保持
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookmarks (
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
