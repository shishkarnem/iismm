import type { PgTableMeta } from './tableDefinitionsCore';

export const PG_CONTENT_TABLES: PgTableMeta[] = [
  {
    name: 'posts',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      category TEXT,
      request_template TEXT,
      post_text TEXT,
      channel TEXT,
      channels TEXT,
      message_format TEXT,
      signature TEXT,
      attachment_type TEXT,
      attachment_url TEXT,
      attachment_urls TEXT,
      audio_format TEXT DEFAULT 'audio',
      audio_title TEXT,
      audio_performer TEXT,
      protect_content INT4 DEFAULT 0,
      link_preview_enabled INT4 DEFAULT 1,
      status TEXT,
      trigger_schedule TEXT,
      published_at TEXT,
      created_at TEXT,
      slug TEXT,
      "desc" TEXT,
      content TEXT,
      inline_buttons_json TEXT,
      is_post_of_day INT4 DEFAULT 0,
      post_of_day_date TEXT,
      format TEXT,
      tag TEXT,
      read_time TEXT,
      date_str TEXT,
      author_name TEXT,
      author_avatar TEXT,
      author_role TEXT,
      views_count INT8 DEFAULT 0,
      likes_count INT8 DEFAULT 0,
      shares_count INT8 DEFAULT 0,
      image_url TEXT,
      video_url TEXT,
      album_json TEXT,
      is_promoted INT4 DEFAULT 0,
      promoted_at TEXT,
      updated_at TEXT
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);`,
      `CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);`
    ]
  },
  {
    name: 'post_comments',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS post_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      parent_comment_id TEXT,
      author_name TEXT NOT NULL,
      author_avatar TEXT,
      author_user_id TEXT,
      author_username TEXT,
      text TEXT NOT NULL,
      likes_count INT4 DEFAULT 0,
      audio_url TEXT,
      created_at TEXT NOT NULL
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);`]
  },
  {
    name: 'post_reactions',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS post_reactions (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reaction_type TEXT DEFAULT 'like',
      created_at TEXT NOT NULL,
      UNIQUE(post_id, user_id)
    );`
  },
  {
    name: 'post_shares',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS post_shares (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      target_type TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      created_at TEXT NOT NULL
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id);`]
  },
  {
    name: 'prompts',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT,
      category TEXT,
      content TEXT,
      author_id TEXT,
      message_format TEXT,
      signature TEXT,
      created_at TEXT
    );`
  },
  {
    name: 'channels',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      username TEXT,
      telegram_id TEXT,
      is_active INT4 DEFAULT 1,
      subscribers_count INT8 DEFAULT 0,
      invite_link TEXT,
      description TEXT,
      photo_url TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_channels_user_id ON channels(user_id);`]
  },
  {
    name: 'channel_branding_settings',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS channel_branding_settings (
      id TEXT PRIMARY KEY,
      description_prompt TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'sceneries',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS sceneries (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      topic_category TEXT,
      target_channels TEXT,
      message_format TEXT,
      enabled INT4 DEFAULT 1,
      schedule TEXT,
      steps TEXT,
      last_run_at TEXT,
      next_run_at TEXT,
      last_status TEXT,
      last_error TEXT,
      created_at TEXT,
      user_id TEXT,
      post_id TEXT,
      nodes TEXT,
      edges TEXT,
      workflow_layout TEXT,
      category TEXT,
      test_results TEXT,
      last_sent_at TEXT,
      last_run_slot TEXT,
      is_sent INT4 DEFAULT 0,
      runs_count INT4 DEFAULT 0,
      updated_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_sceneries_user_id ON sceneries(user_id);`]
  },
  {
    name: 'scenario_instructions',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS scenario_instructions (
      id TEXT PRIMARY KEY,
      target_type TEXT,
      block_type TEXT,
      field_name TEXT,
      title TEXT,
      summary TEXT,
      instruction_text TEXT,
      examples TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'scenario_block_prompts',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS scenario_block_prompts (
      id TEXT PRIMARY KEY,
      node_type TEXT NOT NULL,
      prompt_type TEXT NOT NULL DEFAULT 'default',
      title TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL DEFAULT '',
      user_prompt_template TEXT NOT NULL DEFAULT '',
      variables_hint TEXT,
      output_contract TEXT,
      is_active INT4 DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(node_type, prompt_type)
    );`,
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_sbp_node_prompt ON scenario_block_prompts(node_type, prompt_type);`,
      `CREATE INDEX IF NOT EXISTS idx_sbp_active ON scenario_block_prompts(is_active);`
    ]
  },
  {
    name: 'ai_agents',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS ai_agents (
      id TEXT PRIMARY KEY,
      title TEXT,
      "desc" TEXT,
      tag TEXT,
      btn_text TEXT,
      avatar_emoji TEXT,
      gradient TEXT,
      welcome_message TEXT,
      system_prompt TEXT,
      interactive_user TEXT,
      interactive_assistant TEXT,
      created_at TEXT
    );`
  },
  {
    name: 'ai_button_prompts',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS ai_button_prompts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      prompt_text TEXT,
      layout_rule TEXT,
      custom_instruction TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'system_prompts',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS system_prompts (
      id TEXT PRIMARY KEY,
      scenario_key TEXT UNIQUE,
      title TEXT,
      prompt_text TEXT,
      description TEXT,
      created_at TEXT
    );`
  },
  {
    name: 'protalk_settings',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS protalk_settings (
      id TEXT PRIMARY KEY,
      bot_id TEXT,
      bot_token TEXT,
      default_chat_id TEXT,
      api_url TEXT,
      enabled INT4 DEFAULT 1,
      moderation_log_url TEXT,
      moderation_enabled INT4 DEFAULT 1,
      cost_per_token_rub DOUBLE PRECISION DEFAULT 0.001,
      cost_image_no_text_iirky INT4 DEFAULT 5,
      cost_image_with_text_iirky INT4 DEFAULT 10,
      function_621_id INT4 DEFAULT 621,
      function_784_id INT4 DEFAULT 784,
      function_784_resolution TEXT DEFAULT '1K',
      cost_image_787_iirky INT4 DEFAULT 0,
      function_787_id INT4 DEFAULT 787,
      function_787_ai_model TEXT DEFAULT 'am/flux.2-klein-4b',
      function_787_size TEXT DEFAULT '1024x1024',
      function_787_quality TEXT DEFAULT 'auto',
      function_787_output_format TEXT DEFAULT 'png',
      function_787_response_format TEXT DEFAULT 'b64_json',
      function_787_background TEXT DEFAULT 'auto',
      function_787_mode TEXT DEFAULT 'sync',
      cost_image_791_iirky INT4 DEFAULT 15,
      function_791_id INT4 DEFAULT 791,
      upload_token TEXT,
      created_at TEXT
    );`
  },
  {
    name: 'bot_settings',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS bot_settings (
      id TEXT PRIMARY KEY,
      token TEXT,
      bot_username TEXT,
      created_at TEXT
    );`
  },
  {
    name: 'telegram_bot',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS telegram_bot (
      id TEXT PRIMARY KEY,
      bot_token TEXT,
      bot_name TEXT,
      bot_username TEXT,
      bot_id TEXT,
      description TEXT,
      avatar_url TEXT,
      default_chat_id TEXT,
      api_url TEXT,
      is_active INT4 DEFAULT 1,
      created_at TEXT
    );`
  },
  {
    name: 'telegram_bot_config',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS telegram_bot_config (
      id TEXT PRIMARY KEY,
      config_json TEXT
    );`
  },
  {
    name: 'promo_folders',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS promo_folders (
      id TEXT PRIMARY KEY,
      author_id TEXT,
      author_telegram_id INT8,
      author_username TEXT,
      author_name TEXT,
      title TEXT,
      categories TEXT,
      image_url TEXT,
      post_text TEXT,
      message_format TEXT,
      inline_buttons TEXT,
      max_participants INT4 DEFAULT 20,
      min_subscribers INT4 DEFAULT 0,
      scheduled_at TEXT,
      rules_instruction TEXT,
      repeat_post_enabled INT4 DEFAULT 0,
      repeat_scheduled_at TEXT,
      repeat_image_url TEXT,
      repeat_post_text TEXT,
      repeat_inline_buttons TEXT,
      telegram_folder_link TEXT,
      status TEXT,
      reminder_before_minutes INT4 DEFAULT 60,
      bot_check_before_minutes INT4 DEFAULT 60,
      invite_code TEXT,
      timezone TEXT DEFAULT 'Europe/Moscow',
      reminder_sent INT4 DEFAULT 0,
      attachment_type TEXT,
      attachment_urls TEXT,
      audio_format TEXT DEFAULT 'audio',
      repeat_message_format TEXT DEFAULT 'rich',
      repeat_attachment_type TEXT,
      repeat_attachment_urls TEXT,
      created_at TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'promo_folder_participants',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS promo_folder_participants (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      user_id TEXT,
      channel_id TEXT,
      channel_name TEXT,
      channel_username TEXT,
      subscribers_count INT8 DEFAULT 0,
      avatar_url TEXT,
      joined_at TEXT,
      custom_publish_time TEXT,
      status TEXT,
      reject_reason TEXT,
      is_paid_entry INT4 DEFAULT 0,
      bot_verified INT4 DEFAULT 0,
      is_sponsor INT4 DEFAULT 0,
      sponsor_skip_posting INT4 DEFAULT 0,
      custom_repeat_publish_time TEXT,
      post_published INT4 DEFAULT 0,
      repeat_post_published INT4 DEFAULT 0
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_pfp_folder ON promo_folder_participants(folder_id);`]
  },
  {
    name: 'promo_folder_templates',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS promo_folder_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      template_type TEXT,
      name TEXT,
      title TEXT,
      categories TEXT,
      image_url TEXT,
      post_text TEXT,
      message_format TEXT,
      inline_buttons TEXT,
      rules_instruction TEXT,
      min_subscribers INT4 DEFAULT 0,
      max_participants INT4 DEFAULT 20,
      timezone TEXT DEFAULT 'Europe/Moscow',
      created_at TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'promo_selections',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS promo_selections (
      id TEXT PRIMARY KEY,
      author_id TEXT,
      author_telegram_id INT8,
      author_username TEXT,
      author_name TEXT,
      title TEXT,
      categories TEXT,
      min_subscribers INT4 DEFAULT 0,
      max_participants INT4 DEFAULT 15,
      scheduled_at TEXT,
      header_title TEXT,
      header_subtitle TEXT,
      rules TEXT,
      status TEXT,
      invite_code TEXT,
      results_collected_at TEXT,
      image_url TEXT,
      post_text TEXT,
      message_format TEXT,
      inline_buttons TEXT,
      reminder_before_minutes INT4 DEFAULT 60,
      reminder_sent INT4 DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'promo_selection_channels',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS promo_selection_channels (
      id TEXT PRIMARY KEY,
      selection_id TEXT,
      user_id TEXT,
      channel_id TEXT,
      channel_name TEXT,
      channel_username TEXT,
      channel_avatar_url TEXT,
      promo_text TEXT,
      promo_images TEXT,
      subscribers_initial INT8 DEFAULT 0,
      subscribers_final INT8 DEFAULT 0,
      views_count INT8 DEFAULT 0,
      likes_count INT8 DEFAULT 0,
      reposts_count INT8 DEFAULT 0,
      comments_count INT8 DEFAULT 0,
      moderation_status TEXT,
      moderation_comment TEXT,
      custom_publish_time TEXT,
      status TEXT,
      reject_reason TEXT,
      bot_verified INT4 DEFAULT 0,
      joined_at TEXT,
      post_published INT4 DEFAULT 0
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_psc_selection ON promo_selection_channels(selection_id);`]
  },
  {
    name: 'academy_articles',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS academy_articles (
      id TEXT PRIMARY KEY,
      section_slug TEXT,
      section_title TEXT,
      title TEXT,
      summary TEXT,
      content TEXT,
      format_mode TEXT DEFAULT 'rich',
      attachment_url TEXT,
      attachment_urls TEXT,
      inline_buttons TEXT,
      sort_order INT4 DEFAULT 0,
      is_published INT4 DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );`
  },
  {
    name: 'landing_reviews',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS landing_reviews (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rating INT4 DEFAULT 5,
      text TEXT NOT NULL,
      role TEXT,
      avatar TEXT,
      status TEXT DEFAULT 'approved',
      audio_url TEXT,
      created_at TEXT,
      ai_reply TEXT,
      ai_replied_at TEXT,
      admin_reply TEXT,
      admin_replied_at TEXT,
      moderation_status TEXT DEFAULT 'approved'
    );`
  },
  {
    name: 'notifications',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT,
      title TEXT,
      message TEXT,
      is_read INT4 DEFAULT 0,
      link TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`]
  },
  {
    name: 'cron',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS cron (
      id TEXT PRIMARY KEY,
      item_type TEXT,
      item_id TEXT,
      title TEXT,
      cron_expression TEXT,
      schedule_human TEXT,
      next_run TEXT,
      last_run TEXT,
      status TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_cron_status_next ON cron(status, next_run);`]
  },
  {
    name: 'logs',
    pk: ['id'],
    ddl: `CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      level TEXT,
      message TEXT,
      details TEXT,
      tokens_used INT8 DEFAULT 0,
      cost_rub DOUBLE PRECISION DEFAULT 0.0,
      chat_id TEXT,
      user_id TEXT,
      function_id INT4 DEFAULT 763,
      decision TEXT,
      created_at TEXT
    );`,
    indexes: [`CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);`]
  },
  {
    name: 'app_settings',
    pk: ['setting_key'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`
  },
  {
    name: 'push_subscriptions',
    pk: ['id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      device_label TEXT,
      is_active INT4 DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_success_at TEXT
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);`
    ]
  },
  {
    name: 'push_notification_settings',
    pk: ['user_id'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS push_notification_settings (
      user_id TEXT PRIMARY KEY,
      enabled INT4 DEFAULT 1,
      cat_publish INT4 DEFAULT 1,
      cat_folders INT4 DEFAULT 1,
      cat_balance INT4 DEFAULT 1,
      cat_social INT4 DEFAULT 1,
      cat_ai INT4 DEFAULT 1,
      cat_system INT4 DEFAULT 1,
      telegram_enabled INT4 DEFAULT 1,
      tg_cat_publish INT4 DEFAULT 1,
      tg_cat_folders INT4 DEFAULT 1,
      tg_cat_balance INT4 DEFAULT 1,
      tg_cat_social INT4 DEFAULT 1,
      tg_cat_ai INT4 DEFAULT 1,
      tg_cat_system INT4 DEFAULT 1,
      bell_enabled INT4 DEFAULT 1,
      bell_cat_publish INT4 DEFAULT 1,
      bell_cat_folders INT4 DEFAULT 1,
      bell_cat_balance INT4 DEFAULT 1,
      bell_cat_social INT4 DEFAULT 1,
      bell_cat_ai INT4 DEFAULT 1,
      bell_cat_system INT4 DEFAULT 1,
      updated_at TEXT NOT NULL
    );`
  },
  {
    name: 'telegram_publish_dedup',
    pk: ['dedup_key'],
    hasUpdatedAt: true,
    ddl: `CREATE TABLE IF NOT EXISTS telegram_publish_dedup (
      dedup_key TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      channel_key TEXT NOT NULL,
      content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'processing',
      message_id TEXT,
      created_at_ms INT8 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS idx_tg_dedup_chan_hash ON telegram_publish_dedup(channel_key, content_hash, created_at_ms);`,
      `CREATE INDEX IF NOT EXISTS idx_tg_dedup_entity ON telegram_publish_dedup(entity_id, status, created_at_ms);`
    ]
  }
];
