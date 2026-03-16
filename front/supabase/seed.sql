-- ============================================================
-- Seed データ：AI チャット英語学習システム
-- ============================================================
-- 実行方法:
--   Supabase ダッシュボード > SQL Editor に貼り付けて実行
--
-- テストユーザー:
--   test1@example.com / Test1234!
--   test2@example.com / Test1234!
-- ============================================================

-- RLS・トリガーを一時的に無効化してシードデータを挿入
SET session_replication_role = replica;

-- ------------------------------------------------------------
-- 1. auth.users（テストユーザー）
-- ------------------------------------------------------------
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'test1@example.com',
    crypt('Test1234!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'test2@example.com',
    crypt('Test1234!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    false,
    'authenticated',
    'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. profiles
-- ------------------------------------------------------------
INSERT INTO public.profiles (id, display_name, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'テストユーザー 1', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'テストユーザー 2', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. chat_sessions
-- ------------------------------------------------------------
INSERT INTO public.chat_sessions (id, user_id, created_at, updated_at)
VALUES
  -- ユーザー1のセッション
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() - INTERVAL '2 days', now() - INTERVAL '2 days'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', now() - INTERVAL '1 day',  now() - INTERVAL '1 day'),
  -- ユーザー2のセッション
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', now() - INTERVAL '3 days', now() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 4. messages
-- ------------------------------------------------------------
INSERT INTO public.messages (id, session_id, role, content, created_at)
VALUES
  -- ========== ユーザー1 / セッション1 ==========
  -- 初回 AI メッセージ
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'assistant',
    'こんにちは！今日はどんな英語を学びたいですか？',
    now() - INTERVAL '2 days'
  ),
  -- ユーザーの最初の入力
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'user',
    '会議で使えるフレーズを教えてください',
    now() - INTERVAL '2 days' + INTERVAL '1 minute'
  ),
  -- AI の返答（前文）
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'assistant',
    '会議でよく使われる実用的な英語フレーズを3つ提案します。',
    now() - INTERVAL '2 days' + INTERVAL '2 minutes'
  ),
  -- ユーザーの2回目の入力
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'user',
    'ありがとうを丁寧に言う表現も知りたいです',
    now() - INTERVAL '2 days' + INTERVAL '5 minutes'
  ),
  -- AI の返答（前文）
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'assistant',
    '「ありがとう」を丁寧に伝える英語表現を3つご紹介します。',
    now() - INTERVAL '2 days' + INTERVAL '6 minutes'
  ),

  -- ========== ユーザー1 / セッション2 ==========
  (
    '20000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    'assistant',
    'こんにちは！今日はどんな英語を学びたいですか？',
    now() - INTERVAL '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    'user',
    'カフェで注文するときの英語を教えて',
    now() - INTERVAL '1 day' + INTERVAL '1 minute'
  ),
  (
    '20000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000002',
    'assistant',
    'カフェでの注文に使える英語フレーズを3つ提案します。',
    now() - INTERVAL '1 day' + INTERVAL '2 minutes'
  ),

  -- ========== ユーザー2 / セッション3 ==========
  (
    '20000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000003',
    'assistant',
    'こんにちは！今日はどんな英語を学びたいですか？',
    now() - INTERVAL '3 days'
  ),
  (
    '20000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000003',
    'user',
    'メールで使えるビジネス英語を知りたい',
    now() - INTERVAL '3 days' + INTERVAL '1 minute'
  ),
  (
    '20000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000003',
    'assistant',
    'ビジネスメールで役立つ英語表現を3つ提案します。',
    now() - INTERVAL '3 days' + INTERVAL '2 minutes'
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 5. suggestion_messages
-- ------------------------------------------------------------
INSERT INTO public.suggestion_messages (id, message_id, english_text, japanese_translation, target_language, display_order, created_at)
VALUES
  -- ========== 会議フレーズ（message_id: ...0003）==========
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    'Let''s get the ball rolling.',
    '会議を始めましょう。',
    'en', 1,
    now() - INTERVAL '2 days' + INTERVAL '2 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    'Could you clarify what you mean by that?',
    'それはどういう意味か説明していただけますか？',
    'en', 2,
    now() - INTERVAL '2 days' + INTERVAL '2 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    'Let''s table this for now and move on.',
    'この件はいったん保留にして先に進みましょう。',
    'en', 3,
    now() - INTERVAL '2 days' + INTERVAL '2 minutes'
  ),

  -- ========== ありがとうフレーズ（message_id: ...0005）==========
  (
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000005',
    'I really appreciate your help.',
    'ご協力に心から感謝します。',
    'en', 1,
    now() - INTERVAL '2 days' + INTERVAL '6 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000005',
    'Thank you so much for taking the time.',
    'お時間をいただき、誠にありがとうございます。',
    'en', 2,
    now() - INTERVAL '2 days' + INTERVAL '6 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000005',
    'I''m grateful for your support.',
    'ご支援に感謝しております。',
    'en', 3,
    now() - INTERVAL '2 days' + INTERVAL '6 minutes'
  ),

  -- ========== カフェ注文フレーズ（message_id: ...0008）==========
  (
    '30000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000008',
    'I''d like a medium latte, please.',
    'ミディアムラテをください。',
    'en', 1,
    now() - INTERVAL '1 day' + INTERVAL '2 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000008',
    'Could I get that to go?',
    'テイクアウトにしていただけますか？',
    'en', 2,
    now() - INTERVAL '1 day' + INTERVAL '2 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000009',
    '20000000-0000-0000-0000-000000000008',
    'What''s your most popular drink?',
    '一番人気のドリンクは何ですか？',
    'en', 3,
    now() - INTERVAL '1 day' + INTERVAL '2 minutes'
  ),

  -- ========== ビジネスメールフレーズ（message_id: ...0011）==========
  (
    '30000000-0000-0000-0000-000000000010',
    '20000000-0000-0000-0000-000000000011',
    'I hope this email finds you well.',
    'お世話になっております。',
    'en', 1,
    now() - INTERVAL '3 days' + INTERVAL '2 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000011',
    '20000000-0000-0000-0000-000000000011',
    'Please feel free to reach out if you have any questions.',
    'ご不明な点がございましたら、お気軽にお問い合わせください。',
    'en', 2,
    now() - INTERVAL '3 days' + INTERVAL '2 minutes'
  ),
  (
    '30000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000011',
    'I look forward to hearing from you.',
    'ご連絡をお待ちしております。',
    'en', 3,
    now() - INTERVAL '3 days' + INTERVAL '2 minutes'
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 6. bookmarks（ユーザー1がいくつかブックマーク済み）
-- ------------------------------------------------------------
INSERT INTO public.bookmarks (id, user_id, suggestion_message_id, english_text, japanese_translation, target_language, created_at)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Let''s get the ball rolling.',
    '会議を始めましょう。',
    'en',
    now() - INTERVAL '2 days' + INTERVAL '3 minutes'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000004',
    'I really appreciate your help.',
    'ご協力に心から感謝します。',
    'en',
    now() - INTERVAL '2 days' + INTERVAL '7 minutes'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000008',
    'Could I get that to go?',
    'テイクアウトにしていただけますか？',
    'en',
    now() - INTERVAL '1 day' + INTERVAL '3 minutes'
  )
ON CONFLICT (id) DO NOTHING;

-- RLS・トリガーを元に戻す
SET session_replication_role = DEFAULT;
