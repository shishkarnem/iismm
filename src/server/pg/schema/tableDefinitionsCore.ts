export interface PgTableMeta {
  name: string;
  pk: string[];
  isIdentity?: boolean;
  hasUpdatedAt?: boolean;
  ddl: string;
  indexes?: string[];
}

export const IDENTITY_TABLES = new Set<string>(['file_folders', 'file_storage']);

export const PG_CORE_TABLES: PgTableMeta[] = [
  {
    name: 'file_folders',
    pk: ['id'],
    isIdentity: true,
    ddl: `CREATE TABLE IF NOT EXISTS file_folders (
      id INT8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      parent_id INT8 REFERENCES file_folders(id) ON DELETE SET NULL,
      description TEXT,
      user_id TEXT DEFAULT 'admin',
      color TEXT DEFAULT '#0284c7',
      folder_type TEXT DEFAULT 'custom',
      legacy_id INT8,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_file_folders_user_id ON file_folders(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_file_folders_legacy_id ON file_folders(legacy_id);`
    ]
  },
  {
    name: 'file_storage',
    pk: ['id'],
    isIdentity: true,
    ddl: `CREATE TABLE IF NOT EXISTS file_storage (
      id INT8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY NOT NULL,
      folder_id INT8 REFERENCES file_folders(id) ON DELETE SET NULL,
      filename TEXT NOT NULL DEFAULT 'file.bin',
      url TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INT8 NOT NULL DEFAULT 0,
      size_formatted TEXT,
      preserve_alpha BOOL NOT NULL DEFAULT true,
      target_table TEXT,
      target_column TEXT,
      file_key TEXT,
      user_id TEXT DEFAULT 'admin',
      name TEXT,
      slug_name TEXT,
      original_url TEXT,
      short_url TEXT,
      file_type TEXT DEFAULT 'photo',
      file_size INT8 DEFAULT 0,
      width INT4 DEFAULT 0,
      height INT4 DEFAULT 0,
      aspect_ratio DOUBLE PRECISION DEFAULT 1,
      legacy_id INT8,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_file_storage_file_key ON file_storage(file_key);`,
      `CREATE INDEX IF NOT EXISTS idx_file_storage_user_id ON file_storage(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_file_storage_legacy_id ON file_storage(legacy_id);`
    ]
  },
  {
    name: 'file_folder_relations',
    pk: ['file_id', 'folder_id'],
    ddl: `CREATE TABLE IF NOT EXISTS file_folder_relations (
      file_id INT8 NOT NULL,
      folder_id INT8 NOT NULL,
      PRIMARY KEY (file_id, folder_id)
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_ffr_file ON file_folder_relations(file_id);`,
      `CREATE INDEX IF NOT EXISTS idx_ffr_folder ON file_folder_relations(folder_id);`
    ]
  },
  {
    name: 'files',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      original_name TEXT,
      name TEXT,
      full_url TEXT,
      short_key TEXT,
      short_url TEXT,
      file_type TEXT,
      mime_type TEXT,
      file_size INT8 DEFAULT 0,
      size_formatted TEXT,
      width INT4 DEFAULT 0,
      height INT4 DEFAULT 0,
      aspect_ratio DOUBLE PRECISION DEFAULT 1,
      created_at TEXT
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_files_short_key ON files(short_key);`,
      `CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);`
    ]
  },
  {
    name: 'users',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'user',
      telegram_id INT8,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      photo_url TEXT,
      profile_link TEXT,
      bio TEXT,
      is_premium INT4 DEFAULT 0,
      language_code TEXT DEFAULT 'ru',
      phone TEXT,
      allows_write_to_pm INT4 DEFAULT 0,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      referred_by INT8,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      balance INT8 DEFAULT 0,
      balance_free INT8 DEFAULT 300,
      balance_pay INT8 DEFAULT 0,
      balance_start INT8 DEFAULT 300,
      balance_ref INT8 DEFAULT 0,
      balance_tarif INT8 DEFAULT 0,
      balance_admin INT8 DEFAULT 0,
      balance_cost INT8 DEFAULT 0,
      balance_time TEXT,
      status TEXT DEFAULT 'Активный',
      tariff TEXT DEFAULT 'Старт',
      tarif_date TEXT,
      tariff_expires_at TEXT,
      tariff_assigned_at TEXT,
      tariff_duration_days INT4 DEFAULT 30,
      user_avatar TEXT,
      timezone TEXT DEFAULT 'Europe/Moscow',
      created_at TEXT,
      last_login TEXT,
      referral_reward_balance DOUBLE PRECISION DEFAULT 0.0,
      allow_team_invites INT4 DEFAULT 1,
      team_blacklist TEXT DEFAULT '[]',
      city TEXT,
      last_seen TEXT,
      name TEXT,
      auto_renew_tariff INT4 DEFAULT 1,
      tariff_accrued_at TEXT,
      tariff_warned_expires_at TEXT,
      updated_at TEXT
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);`,
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`
    ]
  },
  {
    name: 'user_subscriptions',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY,
      follower_id TEXT,
      target_id TEXT,
      target_name TEXT,
      target_username TEXT,
      target_avatar TEXT,
      created_at TEXT
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_user_sub_follower ON user_subscriptions(follower_id);`,
      `CREATE INDEX IF NOT EXISTS idx_user_sub_target ON user_subscriptions(target_id);`
    ]
  },
  {
    name: 'user_onboarding_tour',
    pk: ['user_id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS user_onboarding_tour (
      user_id TEXT PRIMARY KEY,
      current_step INT4 DEFAULT 1,
      step1_done INT4 DEFAULT 0,
      step2_done INT4 DEFAULT 0,
      step3_done INT4 DEFAULT 0,
      step4_done INT4 DEFAULT 0,
      tour_completed INT4 DEFAULT 0,
      dismissed INT4 DEFAULT 0,
      selected_channel_id TEXT DEFAULT '',
      created_post_id TEXT DEFAULT '',
      created_scenario_id TEXT DEFAULT '',
      updated_at TEXT
    );`
  },
  {
    name: 'user_post_styles',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS user_post_styles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      "desc" TEXT DEFAULT '',
      prompt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_user_post_styles_user ON user_post_styles(user_id);`]
  },
  {
    name: 'user_auto_responders',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS user_auto_responders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL DEFAULT 'all',
      enabled INT4 NOT NULL DEFAULT 0,
      prompt TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'always',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, chat_id)
    );`
  },
  {
    name: 'user_chats',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS user_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      partner_id TEXT,
      partner_name TEXT,
      partner_username TEXT,
      partner_avatar TEXT,
      title TEXT,
      is_group INT4 DEFAULT 0,
      last_message TEXT,
      last_message_time TEXT,
      updated_at TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_user_chats_user ON user_chats(user_id);`]
  },
  {
    name: 'group_chats',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS group_chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      avatar_url TEXT,
      creator_id TEXT,
      admins_json TEXT,
      members_json TEXT,
      is_default INT4 DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'left_groups',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS left_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      left_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_left_groups_ug ON left_groups(user_id, group_id);`]
  },
  {
    name: 'blocked_chats',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS blocked_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_blocked_chats_up ON blocked_chats(user_id, partner_id);`]
  },
  {
    name: 'hidden_chats',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS hidden_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_hidden_chats_uc ON hidden_chats(user_id, chat_id);`]
  },
  {
    name: 'chat_messages',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT,
      sender TEXT,
      sender_name TEXT,
      text TEXT,
      time TEXT,
      media_url TEXT,
      media_type TEXT,
      images_json TEXT,
      reply_to_json TEXT,
      forwarded_json TEXT,
      file_name TEXT,
      file_size TEXT,
      message_format TEXT DEFAULT 'v2',
      reactions_json TEXT,
      inline_buttons_json TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);`]
  },
  {
    name: 'consultant_messages',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS consultant_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT,
      user_id TEXT,
      sender TEXT,
      text TEXT,
      images_json TEXT,
      db_source TEXT,
      db_summary TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_consultant_messages_chat ON consultant_messages(chat_id);`]
  },
  {
    name: 'teams',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT,
      invite_code TEXT UNIQUE,
      members TEXT,
      channels TEXT,
      created_at TEXT
    );`
  },
  {
    name: 'team_reports',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS team_reports (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      team_name TEXT,
      owner_id TEXT,
      reporter_id TEXT,
      reporter_name TEXT,
      reason TEXT,
      details TEXT,
      status TEXT DEFAULT 'new',
      author_id TEXT,
      author_name TEXT,
      period TEXT,
      posts_published INT4 DEFAULT 0,
      posts_scheduled INT4 DEFAULT 0,
      channels_count INT4 DEFAULT 0,
      created_at TEXT
    );`
  },
  {
    name: 'tarifs',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS tarifs (
      id TEXT PRIMARY KEY,
      name TEXT,
      price_iirky TEXT,
      price_rub INT4 DEFAULT 0,
      sub TEXT,
      continuation TEXT,
      monthly_iirky INT4 DEFAULT 0,
      features TEXT,
      is_active INT4 DEFAULT 1,
      sort_order INT4 DEFAULT 0,
      duration_days INT4 DEFAULT 30,
      duration_text TEXT,
      discount_3m INT4 DEFAULT 0,
      discount_6m INT4 DEFAULT 0,
      discount_12m INT4 DEFAULT 0,
      target_user_id TEXT,
      is_custom INT4 DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'transactions',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT,
      balance_type TEXT,
      amount INT8 DEFAULT 0,
      description TEXT,
      comment TEXT,
      status TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);`]
  },
  {
    name: 'robokassa_invoices',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS robokassa_invoices (
      id TEXT PRIMARY KEY,
      inv_id INT8,
      domain TEXT,
      merchant_login TEXT,
      user_id TEXT,
      payment_type TEXT,
      tariff_name TEXT,
      period_months INT4 DEFAULT 1,
      iirky_quantity INT8 DEFAULT 0,
      out_sum TEXT,
      receipt_json TEXT,
      is_recurring INT4 DEFAULT 0,
      parent_inv_id INT8,
      status TEXT,
      paid_at TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_rk_invoices_inv ON robokassa_invoices(inv_id);`]
  },
  {
    name: 'recurring_consents',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS recurring_consents (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT,
      domain TEXT,
      tariff_name TEXT,
      amount_rub DOUBLE PRECISION DEFAULT 0,
      period_days INT4 DEFAULT 30,
      next_charge_at TEXT,
      consent_checked INT4 DEFAULT 1,
      consent_text TEXT,
      oferta_url TEXT,
      ip_address TEXT,
      user_agent TEXT,
      inv_id INT8,
      status TEXT,
      agreed_at TEXT,
      revoked_at TEXT,
      created_at TEXT
    );`
  },
  {
    name: 'system_configs',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS system_configs (
      id TEXT PRIMARY KEY,
      domain TEXT,
      provider TEXT,
      merchant_login TEXT,
      pass1 TEXT,
      pass2 TEXT,
      result_url TEXT,
      result_method TEXT,
      success_url TEXT,
      success_method TEXT,
      fail_url TEXT,
      fail_method TEXT,
      oferta_url TEXT,
      hash_algo TEXT,
      tax_system TEXT,
      tariff_vat_rate TEXT,
      topup_vat_rate TEXT,
      is_test INT4 DEFAULT 0,
      enabled INT4 DEFAULT 1,
      updated_at TEXT,
      created_at TEXT
    );`
  }
];
