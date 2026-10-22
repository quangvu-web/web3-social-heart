export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      account_merge_requests: {
        Row: {
          admin_note: string | null
          auto_provisioned: boolean | null
          created_at: string
          email: string
          id: string
          merge_type: string
          platform_data: Json | null
          provision_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_platform: string
          source_user_id: string | null
          source_username: string | null
          status: string
          target_platform: string
          target_user_id: string | null
          updated_at: string
          webhook_sent: boolean | null
          webhook_sent_at: string | null
        }
        Insert: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email: string
          id?: string
          merge_type: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Update: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email?: string
          id?: string
          merge_type?: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform?: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Relationships: []
      }
      angel_ai_events: {
        Row: {
          channel: string
          credits_est: number | null
          duration_ms: number
          error: string | null
          id: string
          intent: string
          meta: Json | null
          model: string | null
          ok: boolean
          tier: string | null
          tokens_in: number | null
          tokens_out: number | null
          ts: string
          user_ref: string | null
        }
        Insert: {
          channel: string
          credits_est?: number | null
          duration_ms?: number
          error?: string | null
          id?: string
          intent: string
          meta?: Json | null
          model?: string | null
          ok?: boolean
          tier?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          ts?: string
          user_ref?: string | null
        }
        Update: {
          channel?: string
          credits_est?: number | null
          duration_ms?: number
          error?: string | null
          id?: string
          intent?: string
          meta?: Json | null
          model?: string | null
          ok?: boolean
          tier?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          ts?: string
          user_ref?: string | null
        }
        Relationships: []
      }
      angel_channel_knowledge: {
        Row: {
          chat_id: number
          content: string | null
          core_reference: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          merged_message_ids: number[]
          message_id: number
          next_retry_at: string | null
          posted_at: string | null
          push_error: string | null
          pushed_at: string | null
          pushed_to_core: boolean
          raw_message: Json | null
          retry_count: number
          skip_reason: string | null
          updated_at: string
          youtube_error: string | null
        }
        Insert: {
          chat_id: number
          content?: string | null
          core_reference?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          merged_message_ids?: number[]
          message_id: number
          next_retry_at?: string | null
          posted_at?: string | null
          push_error?: string | null
          pushed_at?: string | null
          pushed_to_core?: boolean
          raw_message?: Json | null
          retry_count?: number
          skip_reason?: string | null
          updated_at?: string
          youtube_error?: string | null
        }
        Update: {
          chat_id?: number
          content?: string | null
          core_reference?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          merged_message_ids?: number[]
          message_id?: number
          next_retry_at?: string | null
          posted_at?: string | null
          push_error?: string | null
          pushed_at?: string | null
          pushed_to_core?: boolean
          raw_message?: Json | null
          retry_count?: number
          skip_reason?: string | null
          updated_at?: string
          youtube_error?: string | null
        }
        Relationships: []
      }
      angel_conversation_summary: {
        Row: {
          channel: string
          created_at: string
          id: string
          last_message_ref: string | null
          scope_key: string
          summary: string
          turns_covered: number
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          last_message_ref?: string | null
          scope_key: string
          summary?: string
          turns_covered?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          last_message_ref?: string | null
          scope_key?: string
          summary?: string
          turns_covered?: number
          updated_at?: string
        }
        Relationships: []
      }
      angel_discussion_comments: {
        Row: {
          channel_chat_id: number | null
          comment_message_id: number | null
          content: string
          content_hash: string | null
          created_at: string
          discussion_chat_id: number
          id: string
          kind: string
          post_message_id: number
          trigger_message_id: number | null
        }
        Insert: {
          channel_chat_id?: number | null
          comment_message_id?: number | null
          content?: string
          content_hash?: string | null
          created_at?: string
          discussion_chat_id: number
          id?: string
          kind?: string
          post_message_id: number
          trigger_message_id?: number | null
        }
        Update: {
          channel_chat_id?: number | null
          comment_message_id?: number | null
          content?: string
          content_hash?: string | null
          created_at?: string
          discussion_chat_id?: number
          id?: string
          kind?: string
          post_message_id?: number
          trigger_message_id?: number | null
        }
        Relationships: []
      }
      angel_fal_image_usage: {
        Row: {
          count: number
          created_at: string
          id: string
          updated_at: string
          usage_day: string
          user_ref: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_day: string
          user_ref: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_day?: string
          user_ref?: string
        }
        Relationships: []
      }
      angel_feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          meta: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          meta?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          meta?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      angel_image_pipeline_logs: {
        Row: {
          created_at: string
          design_heavy: boolean
          duration_ms: number | null
          error_msg: string | null
          error_status: number | null
          fallback_stage: string | null
          final_prompt_len: number | null
          force_hd: boolean
          heavy: boolean
          id: string
          meta: Json | null
          model: string | null
          ok: boolean
          prompt_len: number | null
          tier: string
          topic: string | null
          user_ref: string | null
        }
        Insert: {
          created_at?: string
          design_heavy?: boolean
          duration_ms?: number | null
          error_msg?: string | null
          error_status?: number | null
          fallback_stage?: string | null
          final_prompt_len?: number | null
          force_hd?: boolean
          heavy?: boolean
          id?: string
          meta?: Json | null
          model?: string | null
          ok: boolean
          prompt_len?: number | null
          tier: string
          topic?: string | null
          user_ref?: string | null
        }
        Update: {
          created_at?: string
          design_heavy?: boolean
          duration_ms?: number | null
          error_msg?: string | null
          error_status?: number | null
          fallback_stage?: string | null
          final_prompt_len?: number | null
          force_hd?: boolean
          heavy?: boolean
          id?: string
          meta?: Json | null
          model?: string | null
          ok?: boolean
          prompt_len?: number | null
          tier?: string
          topic?: string | null
          user_ref?: string | null
        }
        Relationships: []
      }
      angel_last_question: {
        Row: {
          anchor_context: string | null
          chat_message_id: number | null
          question: string
          scope_key: string
          updated_at: string
        }
        Insert: {
          anchor_context?: string | null
          chat_message_id?: number | null
          question: string
          scope_key: string
          updated_at?: string
        }
        Update: {
          anchor_context?: string | null
          chat_message_id?: number | null
          question?: string
          scope_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      angel_lovable_image_fallback_usage: {
        Row: {
          count: number
          id: string
          updated_at: string
          usage_day: string
          user_ref: string
        }
        Insert: {
          count?: number
          id?: string
          updated_at?: string
          usage_day?: string
          user_ref: string
        }
        Update: {
          count?: number
          id?: string
          updated_at?: string
          usage_day?: string
          user_ref?: string
        }
        Relationships: []
      }
      angel_memory_settings: {
        Row: {
          enabled_group: boolean
          enabled_inline: boolean
          enabled_telegram_dm: boolean
          enabled_web: boolean
          id: number
          rolling_summary_dm: boolean
          rolling_summary_group: boolean
          rolling_summary_keep_recent: number
          rolling_summary_turn_threshold: number
          rolling_summary_web: boolean
          updated_at: string
        }
        Insert: {
          enabled_group?: boolean
          enabled_inline?: boolean
          enabled_telegram_dm?: boolean
          enabled_web?: boolean
          id?: number
          rolling_summary_dm?: boolean
          rolling_summary_group?: boolean
          rolling_summary_keep_recent?: number
          rolling_summary_turn_threshold?: number
          rolling_summary_web?: boolean
          updated_at?: string
        }
        Update: {
          enabled_group?: boolean
          enabled_inline?: boolean
          enabled_telegram_dm?: boolean
          enabled_web?: boolean
          id?: number
          rolling_summary_dm?: boolean
          rolling_summary_group?: boolean
          rolling_summary_keep_recent?: number
          rolling_summary_turn_threshold?: number
          rolling_summary_web?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      angel_persona_settings: {
        Row: {
          id: string
          notes: string | null
          persona_prompt: string | null
          rule_overrides: Json
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          persona_prompt?: string | null
          rule_overrides?: Json
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          persona_prompt?: string | null
          rule_overrides?: Json
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      angel_prompt_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          notes: string | null
          published_at: string | null
          rule_key: string
          version_number: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          notes?: string | null
          published_at?: string | null
          rule_key: string
          version_number: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          notes?: string | null
          published_at?: string | null
          rule_key?: string
          version_number?: number
        }
        Relationships: []
      }
      angel_user_memory: {
        Row: {
          channel: string
          created_at: string
          display_name: string | null
          facts: Json
          id: string
          last_extracted_at: string | null
          last_seen_at: string
          preferred_language: string | null
          turn_count: number
          updated_at: string
          user_key: string
        }
        Insert: {
          channel: string
          created_at?: string
          display_name?: string | null
          facts?: Json
          id?: string
          last_extracted_at?: string | null
          last_seen_at?: string
          preferred_language?: string | null
          turn_count?: number
          updated_at?: string
          user_key: string
        }
        Update: {
          channel?: string
          created_at?: string
          display_name?: string | null
          facts?: Json
          id?: string
          last_extracted_at?: string | null
          last_seen_at?: string
          preferred_language?: string | null
          turn_count?: number
          updated_at?: string
          user_key?: string
        }
        Relationships: []
      }
      angel_watched_channels: {
        Row: {
          added_by: string | null
          auto_push_to_core: boolean
          chat_id: number
          created_at: string
          id: string
          ingested_count: number
          is_active: boolean
          last_long_warned_at: string | null
          last_message_id: number | null
          last_synced_at: string | null
          notes: string | null
          title: string | null
          updated_at: string
          username: string | null
          warn_long_posts: boolean
        }
        Insert: {
          added_by?: string | null
          auto_push_to_core?: boolean
          chat_id: number
          created_at?: string
          id?: string
          ingested_count?: number
          is_active?: boolean
          last_long_warned_at?: string | null
          last_message_id?: number | null
          last_synced_at?: string | null
          notes?: string | null
          title?: string | null
          updated_at?: string
          username?: string | null
          warn_long_posts?: boolean
        }
        Update: {
          added_by?: string | null
          auto_push_to_core?: boolean
          chat_id?: number
          created_at?: string
          id?: string
          ingested_count?: number
          is_active?: boolean
          last_long_warned_at?: string | null
          last_message_id?: number | null
          last_synced_at?: string | null
          notes?: string | null
          title?: string | null
          updated_at?: string
          username?: string | null
          warn_long_posts?: boolean
        }
        Relationships: []
      }
      angel_web_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      angel_youtube_transcript_cache: {
        Row: {
          author: string | null
          created_at: string
          expires_at: string
          failure_reason: string | null
          fetched_at: string
          hit_count: number
          is_auto: boolean | null
          language: string | null
          title: string | null
          transcript: string | null
          updated_at: string
          url: string
          video_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          expires_at?: string
          failure_reason?: string | null
          fetched_at?: string
          hit_count?: number
          is_auto?: boolean | null
          language?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          url: string
          video_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
          expires_at?: string
          failure_reason?: string | null
          fetched_at?: string
          hit_count?: number
          is_auto?: boolean | null
          language?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          url?: string
          video_id?: string
        }
        Relationships: []
      }
      app_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_last4: string
          key_prefix: string
          notes: string | null
          revoked_at: string | null
          rotated_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_last4: string
          key_prefix: string
          notes?: string | null
          revoked_at?: string | null
          rotated_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_last4?: string
          key_prefix?: string
          notes?: string | null
          revoked_at?: string | null
          rotated_at?: string | null
          status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      blacklisted_wallets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_permanent: boolean
          reason: string
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_session_id: string | null
          created_at: string | null
          id: string
          is_muted: boolean | null
          is_video_off: boolean | null
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_type: string
          channel_name: string
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          initiator_id: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          call_type: string
          channel_name: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiator_id: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          call_type?: string
          channel_name?: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiator_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      caption_lines: {
        Row: {
          created_at: string
          dedupe_key: string
          id: string
          seq: number
          session_id: string
          source_lang: string | null
          speaker_name: string | null
          text_en: string | null
          text_source: string
          text_vi: string | null
          ts_offset_sec: number | null
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          id?: string
          seq: number
          session_id: string
          source_lang?: string | null
          speaker_name?: string | null
          text_en?: string | null
          text_source: string
          text_vi?: string | null
          ts_offset_sec?: number | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          id?: string
          seq?: number
          session_id?: string
          source_lang?: string | null
          speaker_name?: string | null
          text_en?: string | null
          text_source?: string
          text_vi?: string | null
          ts_offset_sec?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caption_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "caption_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      caption_sessions: {
        Row: {
          created_at: string
          created_by_chat_id: number | null
          created_by_telegram_id: number | null
          ended_at: string | null
          id: string
          meeting_url: string
          platform: string | null
          public_code: string
          recall_bot_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by_chat_id?: number | null
          created_by_telegram_id?: number | null
          ended_at?: string | null
          id?: string
          meeting_url: string
          platform?: string | null
          public_code: string
          recall_bot_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by_chat_id?: number | null
          created_by_telegram_id?: number | null
          ended_at?: string | null
          id?: string
          meeting_url?: string
          platform?: string | null
          public_code?: string
          recall_bot_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      chat_settings: {
        Row: {
          created_at: string | null
          id: string
          show_read_receipts: boolean | null
          show_typing_indicator: boolean | null
          updated_at: string | null
          user_id: string
          who_can_message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id: string
          who_can_message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id?: string
          who_can_message?: string | null
        }
        Relationships: []
      }
      cloud_usage_events: {
        Row: {
          bytes_out: number | null
          duration_ms: number
          feature: string | null
          function_name: string
          id: number
          meta: Json | null
          occurred_at: string
          status_code: number | null
        }
        Insert: {
          bytes_out?: number | null
          duration_ms?: number
          feature?: string | null
          function_name: string
          id?: number
          meta?: Json | null
          occurred_at?: string
          status_code?: number | null
        }
        Update: {
          bytes_out?: number | null
          duration_ms?: number
          feature?: string | null
          function_name?: string
          id?: number
          meta?: Json | null
          occurred_at?: string
          status_code?: number | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          parent_comment_id: string | null
          post_id: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          left_at: string | null
          muted_until: string | null
          nickname: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      creator_library: {
        Row: {
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          filesize_bytes: number | null
          id: string
          live_replay_id: string | null
          live_session_id: string | null
          media_type: string
          playback_provider: string
          post_id: string | null
          r2_bucket: string | null
          r2_object_key: string
          source_stream_uid: string | null
          status: string
          storage_provider: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          filesize_bytes?: number | null
          id?: string
          live_replay_id?: string | null
          live_session_id?: string | null
          media_type?: string
          playback_provider?: string
          post_id?: string | null
          r2_bucket?: string | null
          r2_object_key: string
          source_stream_uid?: string | null
          status?: string
          storage_provider?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          filesize_bytes?: number | null
          id?: string
          live_replay_id?: string | null
          live_session_id?: string | null
          media_type?: string
          playback_provider?: string
          post_id?: string | null
          r2_bucket?: string | null
          r2_object_key?: string
          source_stream_uid?: string | null
          status?: string
          storage_provider?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_library_live_replay_id_fkey"
            columns: ["live_replay_id"]
            isOneToOne: false
            referencedRelation: "live_replays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_platform_tokens: {
        Row: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at: string
          device_info: Json | null
          id: string
          is_revoked: boolean
          last_used_at: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope: string[]
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope?: string[]
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          client_id?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token?: string
          refresh_token_expires_at?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_platform_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_gifts: {
        Row: {
          amount_numeric: number
          chain_id: number
          conversation_id: string | null
          created_at: string
          error: string | null
          from_user_id: string
          id: string
          message_id: string | null
          status: string
          to_address: string
          to_user_id: string
          token: string
          tx_hash: string | null
        }
        Insert: {
          amount_numeric: number
          chain_id?: number
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_user_id: string
          id?: string
          message_id?: string | null
          status?: string
          to_address: string
          to_user_id: string
          token: string
          tx_hash?: string | null
        }
        Update: {
          amount_numeric?: number
          chain_id?: number
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_user_id?: string
          id?: string
          message_id?: string | null
          status?: string
          to_address?: string
          to_user_id?: string
          token?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crypto_gifts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custodial_wallets: {
        Row: {
          chain_id: number
          created_at: string
          encrypted_private_key: string
          encryption_version: number
          id: string
          is_active: boolean
          last_activity_at: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          chain_id?: number
          created_at?: string
          encrypted_private_key: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          chain_id?: number
          created_at?: string
          encrypted_private_key?: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_link_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          author_id: string | null
          caption: string | null
          created_at: string | null
          id: string
          media_key: string | null
          media_url: string | null
          recording_id: string | null
          source: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          id?: string
          media_key?: string | null
          media_url?: string | null
          recording_id?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          id?: string
          media_key?: string | null
          media_url?: string | null
          recording_id?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "live_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          action: string
          amount: number
          client_id: string
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id: string
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fun_api_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fun_api_sync_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fun_api_sync_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_game_anti_cheat_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          risk_score: number
          severity: string
          signal: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          risk_score?: number
          severity?: string
          signal?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          risk_score?: number
          severity?: string
          signal?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      fun_game_box_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          jackpot_budget: number
          probability_table: Json
          rarity: Database["public"]["Enums"]["fun_game_rarity"]
          season: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          jackpot_budget?: number
          probability_table: Json
          rarity?: Database["public"]["Enums"]["fun_game_rarity"]
          season?: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          jackpot_budget?: number
          probability_table?: Json
          rarity?: Database["public"]["Enums"]["fun_game_rarity"]
          season?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fun_game_daily_quests: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          progress_count: number
          proof: Json
          quest_date: string
          quest_template_id: string
          risk_score: number
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          progress_count?: number
          proof?: Json
          quest_date?: string
          quest_template_id: string
          risk_score?: number
          target_count: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          progress_count?: number
          proof?: Json
          quest_date?: string
          quest_template_id?: string
          risk_score?: number
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fun_game_daily_quests_quest_template_id_fkey"
            columns: ["quest_template_id"]
            isOneToOne: false
            referencedRelation: "fun_game_quest_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_game_inventory_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          metadata: Json
          nft_chain_id: number | null
          nft_contract_address: string | null
          nft_token_id: string | null
          rarity: Database["public"]["Enums"]["fun_game_rarity"]
          title: string
          transferable: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          metadata?: Json
          nft_chain_id?: number | null
          nft_contract_address?: string | null
          nft_token_id?: string | null
          rarity?: Database["public"]["Enums"]["fun_game_rarity"]
          title: string
          transferable?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          metadata?: Json
          nft_chain_id?: number | null
          nft_contract_address?: string | null
          nft_token_id?: string | null
          rarity?: Database["public"]["Enums"]["fun_game_rarity"]
          title?: string
          transferable?: boolean
          user_id?: string
        }
        Relationships: []
      }
      fun_game_pets: {
        Row: {
          aura: number
          created_at: string
          energy: number
          equipped_skin_item_id: string | null
          id: string
          last_interaction_at: string | null
          level: number
          mood: number
          name: string
          personality_seed: string
          rarity: Database["public"]["Enums"]["fun_game_rarity"]
          skills: Json
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          aura?: number
          created_at?: string
          energy?: number
          equipped_skin_item_id?: string | null
          id?: string
          last_interaction_at?: string | null
          level?: number
          mood?: number
          name?: string
          personality_seed?: string
          rarity?: Database["public"]["Enums"]["fun_game_rarity"]
          skills?: Json
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          aura?: number
          created_at?: string
          energy?: number
          equipped_skin_item_id?: string | null
          id?: string
          last_interaction_at?: string | null
          level?: number
          mood?: number
          name?: string
          personality_seed?: string
          rarity?: Database["public"]["Enums"]["fun_game_rarity"]
          skills?: Json
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      fun_game_profiles: {
        Row: {
          active_season: string
          created_at: string
          last_daily_reset_at: string | null
          light_score: number
          reward_multiplier: number
          risk_score: number
          streak_days: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          active_season?: string
          created_at?: string
          last_daily_reset_at?: string | null
          light_score?: number
          reward_multiplier?: number
          risk_score?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          active_season?: string
          created_at?: string
          last_daily_reset_at?: string | null
          light_score?: number
          reward_multiplier?: number
          risk_score?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      fun_game_quest_templates: {
        Row: {
          ai_moderation_required: boolean
          code: string
          cooldown_seconds: number
          created_at: string
          daily_cap: number
          description: string
          event_type: Database["public"]["Enums"]["fun_game_event_type"]
          id: string
          is_active: boolean
          light_score_delta: number
          metadata: Json
          reward_amount: number
          reward_type: Database["public"]["Enums"]["fun_game_reward_type"]
          target_count: number
          title: string
          updated_at: string
        }
        Insert: {
          ai_moderation_required?: boolean
          code: string
          cooldown_seconds?: number
          created_at?: string
          daily_cap?: number
          description: string
          event_type?: Database["public"]["Enums"]["fun_game_event_type"]
          id?: string
          is_active?: boolean
          light_score_delta?: number
          metadata?: Json
          reward_amount?: number
          reward_type: Database["public"]["Enums"]["fun_game_reward_type"]
          target_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          ai_moderation_required?: boolean
          code?: string
          cooldown_seconds?: number
          created_at?: string
          daily_cap?: number
          description?: string
          event_type?: Database["public"]["Enums"]["fun_game_event_type"]
          id?: string
          is_active?: boolean
          light_score_delta?: number
          metadata?: Json
          reward_amount?: number
          reward_type?: Database["public"]["Enums"]["fun_game_reward_type"]
          target_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fun_game_reward_ledger: {
        Row: {
          amount: number
          approved_at: string | null
          chain_id: number | null
          created_at: string
          id: string
          idempotency_key: string
          metadata: Json
          paid_at: string | null
          review_reason: string | null
          reward_type: Database["public"]["Enums"]["fun_game_reward_type"]
          risk_score: number
          source_id: string | null
          source_type: Database["public"]["Enums"]["fun_game_event_type"]
          status: Database["public"]["Enums"]["fun_game_reward_status"]
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          chain_id?: number | null
          created_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json
          paid_at?: string | null
          review_reason?: string | null
          reward_type: Database["public"]["Enums"]["fun_game_reward_type"]
          risk_score?: number
          source_id?: string | null
          source_type: Database["public"]["Enums"]["fun_game_event_type"]
          status?: Database["public"]["Enums"]["fun_game_reward_status"]
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          chain_id?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          paid_at?: string | null
          review_reason?: string | null
          reward_type?: Database["public"]["Enums"]["fun_game_reward_type"]
          risk_score?: number
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["fun_game_event_type"]
          status?: Database["public"]["Enums"]["fun_game_reward_status"]
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fun_game_treasure_claims: {
        Row: {
          answer_hash: string | null
          created_at: string
          event_id: string
          geo_confidence: number | null
          id: string
          proof: Json
          qr_nonce_hash: string | null
          reviewed_at: string | null
          risk_score: number
          status: Database["public"]["Enums"]["fun_game_reward_status"]
          team_id: string | null
          user_id: string
        }
        Insert: {
          answer_hash?: string | null
          created_at?: string
          event_id: string
          geo_confidence?: number | null
          id?: string
          proof?: Json
          qr_nonce_hash?: string | null
          reviewed_at?: string | null
          risk_score?: number
          status?: Database["public"]["Enums"]["fun_game_reward_status"]
          team_id?: string | null
          user_id: string
        }
        Update: {
          answer_hash?: string | null
          created_at?: string
          event_id?: string
          geo_confidence?: number | null
          id?: string
          proof?: Json
          qr_nonce_hash?: string | null
          reviewed_at?: string | null
          risk_score?: number
          status?: Database["public"]["Enums"]["fun_game_reward_status"]
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fun_game_treasure_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "fun_game_treasure_events"
            referencedColumns: ["id"]
          },
        ]
      }
      fun_game_treasure_events: {
        Row: {
          claim_count: number
          clues: Json
          code: string
          created_at: string
          description: string
          ends_at: string
          geo_required: boolean
          id: string
          is_active: boolean
          max_claims: number | null
          qr_required: boolean
          reward_table: Json
          starts_at: string
          team_size_min: number
          title: string
          updated_at: string
        }
        Insert: {
          claim_count?: number
          clues?: Json
          code: string
          created_at?: string
          description: string
          ends_at: string
          geo_required?: boolean
          id?: string
          is_active?: boolean
          max_claims?: number | null
          qr_required?: boolean
          reward_table?: Json
          starts_at: string
          team_size_min?: number
          title: string
          updated_at?: string
        }
        Update: {
          claim_count?: number
          clues?: Json
          code?: string
          created_at?: string
          description?: string
          ends_at?: string
          geo_required?: boolean
          id?: string
          is_active?: boolean
          max_claims?: number | null
          qr_required?: boolean
          reward_table?: Json
          starts_at?: string
          team_size_min?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fun_game_user_boxes: {
        Row: {
          box_type_id: string
          client_seed: string | null
          created_at: string
          id: string
          nonce: number
          opened_at: string | null
          reward_ledger_id: string | null
          server_seed_hash: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          box_type_id: string
          client_seed?: string | null
          created_at?: string
          id?: string
          nonce?: number
          opened_at?: string | null
          reward_ledger_id?: string | null
          server_seed_hash?: string | null
          source: string
          status?: string
          user_id: string
        }
        Update: {
          box_type_id?: string
          client_seed?: string | null
          created_at?: string
          id?: string
          nonce?: number
          opened_at?: string | null
          reward_ledger_id?: string | null
          server_seed_hash?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fun_game_user_boxes_box_type_id_fkey"
            columns: ["box_type_id"]
            isOneToOne: false
            referencedRelation: "fun_game_box_types"
            referencedColumns: ["id"]
          },
        ]
      }
      live_comments: {
        Row: {
          created_at: string
          id: string
          live_session_id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_session_id: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_session_id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_comments_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_guest_sessions: {
        Row: {
          accepted_at: string | null
          agora_channel_name: string
          agora_uid: number
          created_at: string
          end_reason: string | null
          ended_at: string | null
          guest_user_id: string
          host_user_id: string
          id: string
          invited_at: string
          joined_at: string | null
          last_heartbeat_at: string | null
          layout_update_result: Json
          live_session_id: string
          muted_by_host: boolean
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agora_channel_name: string
          agora_uid: number
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          guest_user_id: string
          host_user_id: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          last_heartbeat_at?: string | null
          layout_update_result?: Json
          live_session_id: string
          muted_by_host?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agora_channel_name?: string
          agora_uid?: number
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          guest_user_id?: string
          host_user_id?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          last_heartbeat_at?: string | null
          layout_update_result?: Json
          live_session_id?: string
          muted_by_host?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_guest_sessions_guest_user_id_fkey"
            columns: ["guest_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_guest_sessions_guest_user_id_fkey"
            columns: ["guest_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_guest_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_guest_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_guest_sessions_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: never
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: never
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_recording_chunks: {
        Row: {
          chunk_index: number
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          live_session_id: string
          mime_type: string | null
          post_id: string | null
          provider: string
          r2_bucket: string
          r2_key: string
          size_bytes: number | null
          status: string | null
          uploaded_at: string | null
        }
        Insert: {
          chunk_index: number
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          live_session_id: string
          mime_type?: string | null
          post_id?: string | null
          provider?: string
          r2_bucket: string
          r2_key: string
          size_bytes?: number | null
          status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          chunk_index?: number
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          live_session_id?: string
          mime_type?: string | null
          post_id?: string | null
          provider?: string
          r2_bucket?: string
          r2_key?: string
          size_bytes?: number | null
          status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_recording_chunks_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_recording_chunks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      live_recordings: {
        Row: {
          created_at: string | null
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          file_list_json: Json | null
          id: string
          live_id: string | null
          media_url: string | null
          mode: string | null
          raw_response: Json | null
          recorder_uid: string | null
          resource_id: string | null
          sid: string | null
          status: string | null
          stopped_at: string | null
          storage_region: number | null
          storage_vendor: number | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string | null
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          file_list_json?: Json | null
          id?: string
          live_id?: string | null
          media_url?: string | null
          mode?: string | null
          raw_response?: Json | null
          recorder_uid?: string | null
          resource_id?: string | null
          sid?: string | null
          status?: string | null
          stopped_at?: string | null
          storage_region?: number | null
          storage_vendor?: number | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string | null
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          file_list_json?: Json | null
          id?: string
          live_id?: string | null
          media_url?: string | null
          mode?: string | null
          raw_response?: Json | null
          recorder_uid?: string | null
          resource_id?: string | null
          sid?: string | null
          status?: string | null
          stopped_at?: string | null
          storage_region?: number | null
          storage_vendor?: number | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_recordings_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_replays: {
        Row: {
          archive_attempts: number
          archive_error: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          chunked_recording_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          created_at: string
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          error_message: string | null
          filesize_bytes: number | null
          id: string
          live_session_id: string
          next_archive_retry_at: string | null
          playback_dash: string | null
          playback_hls: string | null
          playback_mp4: string | null
          playback_provider: string
          processing_started_at: string | null
          r2_bucket: string | null
          r2_object_key: string | null
          r2_video_url: string | null
          source_webm_key: string | null
          status: string
          storage_provider: string
          stream_deleted_at: string | null
          stream_uid: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archive_attempts?: number
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          chunked_recording_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          created_at?: string
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          filesize_bytes?: number | null
          id?: string
          live_session_id: string
          next_archive_retry_at?: string | null
          playback_dash?: string | null
          playback_hls?: string | null
          playback_mp4?: string | null
          playback_provider?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          source_webm_key?: string | null
          status?: string
          storage_provider?: string
          stream_deleted_at?: string | null
          stream_uid: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archive_attempts?: number
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          chunked_recording_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          created_at?: string
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          filesize_bytes?: number | null
          id?: string
          live_session_id?: string
          next_archive_retry_at?: string | null
          playback_dash?: string | null
          playback_hls?: string | null
          playback_mp4?: string | null
          playback_provider?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          source_webm_key?: string | null
          status?: string
          storage_provider?: string
          stream_deleted_at?: string | null
          stream_uid?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          agora_channel: string | null
          agora_uid: number | null
          agora_uid_host: number | null
          archive_bucket: string | null
          archive_error: string | null
          archive_object_key: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          browser_recording_chunk_count: number
          browser_recording_status: string
          browser_recording_total_bytes: number
          browser_recording_warning: string | null
          channel_name: string
          cleanup_attempts: number
          cleanup_finished_at: string | null
          cleanup_started_at: string | null
          client_state: string | null
          cloudflare_live_input_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          cloudflare_video_uid: string | null
          created_at: string
          description: string | null
          disconnect_detected_at: string | null
          download_mp4_parts: Json
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          error_message: string | null
          go_live_clicked_at: string | null
          heartbeat_agora_channel_name: string | null
          heartbeat_count: number
          heartbeat_device_type: string | null
          heartbeat_source_type: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_connection_status: string
          host_heartbeat_at: string | null
          host_user_id: string
          id: string
          last_cleanup_at: string | null
          last_heartbeat_at: string | null
          last_host_heartbeat_at: string | null
          last_media_activity_at: string | null
          last_recording_query_at: string | null
          last_recording_query_result: Json
          last_seen_at: string | null
          last_viewer_activity_at: string | null
          last_worker_response: Json | null
          live_mode: string
          live_post_id: string | null
          mode: string | null
          owner_id: string | null
          playback_provider: string | null
          playback_url: string | null
          post_id: string | null
          privacy: string
          processing_started_at: string | null
          producer_active_at: string | null
          producer_disconnected_at: string | null
          producer_input_enabled: boolean
          r2_bucket: string | null
          r2_object_key: string | null
          r2_recording_key: string | null
          r2_recording_size: number | null
          r2_video_url: string | null
          recording_acquired_at: string | null
          recording_error: string | null
          recording_error_code: string | null
          recording_error_message: string | null
          recording_files: Json
          recording_last_query_at: string | null
          recording_provider: string
          recording_ready_at: string | null
          recording_resource_id: string | null
          recording_retry_count: number
          recording_sid: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stop_requested_at: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          replay_post_created_at: string | null
          replay_post_id: string | null
          replay_url: string | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          rtmps_url: string | null
          sid: string | null
          source: string | null
          source_connected_at: string | null
          started_at: string
          status: string
          stop_requested_at: string | null
          stopped_at: string | null
          storage_provider: string | null
          stream_deleted_at: string | null
          stream_key: string | null
          stream_key_encrypted: string | null
          stream_key_last_reset_at: string | null
          stream_key_last_shown_at: string | null
          stream_provider: string
          temp_bucket: string | null
          temp_object_key: string | null
          thumbnail_url: string | null
          title: string
          total_duration_seconds: number | null
          updated_at: string
          user_id: string | null
          viewer_count: number
          watchdog_stop_result: Json
        }
        Insert: {
          agora_channel?: string | null
          agora_uid?: number | null
          agora_uid_host?: number | null
          archive_bucket?: string | null
          archive_error?: string | null
          archive_object_key?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          browser_recording_chunk_count?: number
          browser_recording_status?: string
          browser_recording_total_bytes?: number
          browser_recording_warning?: string | null
          channel_name: string
          cleanup_attempts?: number
          cleanup_finished_at?: string | null
          cleanup_started_at?: string | null
          client_state?: string | null
          cloudflare_live_input_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          cloudflare_video_uid?: string | null
          created_at?: string
          description?: string | null
          disconnect_detected_at?: string | null
          download_mp4_parts?: Json
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          error_message?: string | null
          go_live_clicked_at?: string | null
          heartbeat_agora_channel_name?: string | null
          heartbeat_count?: number
          heartbeat_device_type?: string | null
          heartbeat_source_type?: string | null
          hls_playback_url?: string | null
          hls_url?: string | null
          host_connection_status?: string
          host_heartbeat_at?: string | null
          host_user_id: string
          id?: string
          last_cleanup_at?: string | null
          last_heartbeat_at?: string | null
          last_host_heartbeat_at?: string | null
          last_media_activity_at?: string | null
          last_recording_query_at?: string | null
          last_recording_query_result?: Json
          last_seen_at?: string | null
          last_viewer_activity_at?: string | null
          last_worker_response?: Json | null
          live_mode?: string
          live_post_id?: string | null
          mode?: string | null
          owner_id?: string | null
          playback_provider?: string | null
          playback_url?: string | null
          post_id?: string | null
          privacy?: string
          processing_started_at?: string | null
          producer_active_at?: string | null
          producer_disconnected_at?: string | null
          producer_input_enabled?: boolean
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_recording_key?: string | null
          r2_recording_size?: number | null
          r2_video_url?: string | null
          recording_acquired_at?: string | null
          recording_error?: string | null
          recording_error_code?: string | null
          recording_error_message?: string | null
          recording_files?: Json
          recording_last_query_at?: string | null
          recording_provider?: string
          recording_ready_at?: string | null
          recording_resource_id?: string | null
          recording_retry_count?: number
          recording_sid?: string | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_stop_requested_at?: string | null
          recording_stopped_at?: string | null
          recording_uid?: number | null
          replay_post_created_at?: string | null
          replay_post_id?: string | null
          replay_url?: string | null
          resource_id?: string | null
          rtmp_ended_at?: string | null
          rtmp_started_at?: string | null
          rtmp_status?: string | null
          rtmps_url?: string | null
          sid?: string | null
          source?: string | null
          source_connected_at?: string | null
          started_at?: string
          status?: string
          stop_requested_at?: string | null
          stopped_at?: string | null
          storage_provider?: string | null
          stream_deleted_at?: string | null
          stream_key?: string | null
          stream_key_encrypted?: string | null
          stream_key_last_reset_at?: string | null
          stream_key_last_shown_at?: string | null
          stream_provider?: string
          temp_bucket?: string | null
          temp_object_key?: string | null
          thumbnail_url?: string | null
          title?: string
          total_duration_seconds?: number | null
          updated_at?: string
          user_id?: string | null
          viewer_count?: number
          watchdog_stop_result?: Json
        }
        Update: {
          agora_channel?: string | null
          agora_uid?: number | null
          agora_uid_host?: number | null
          archive_bucket?: string | null
          archive_error?: string | null
          archive_object_key?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          browser_recording_chunk_count?: number
          browser_recording_status?: string
          browser_recording_total_bytes?: number
          browser_recording_warning?: string | null
          channel_name?: string
          cleanup_attempts?: number
          cleanup_finished_at?: string | null
          cleanup_started_at?: string | null
          client_state?: string | null
          cloudflare_live_input_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          cloudflare_video_uid?: string | null
          created_at?: string
          description?: string | null
          disconnect_detected_at?: string | null
          download_mp4_parts?: Json
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          error_message?: string | null
          go_live_clicked_at?: string | null
          heartbeat_agora_channel_name?: string | null
          heartbeat_count?: number
          heartbeat_device_type?: string | null
          heartbeat_source_type?: string | null
          hls_playback_url?: string | null
          hls_url?: string | null
          host_connection_status?: string
          host_heartbeat_at?: string | null
          host_user_id?: string
          id?: string
          last_cleanup_at?: string | null
          last_heartbeat_at?: string | null
          last_host_heartbeat_at?: string | null
          last_media_activity_at?: string | null
          last_recording_query_at?: string | null
          last_recording_query_result?: Json
          last_seen_at?: string | null
          last_viewer_activity_at?: string | null
          last_worker_response?: Json | null
          live_mode?: string
          live_post_id?: string | null
          mode?: string | null
          owner_id?: string | null
          playback_provider?: string | null
          playback_url?: string | null
          post_id?: string | null
          privacy?: string
          processing_started_at?: string | null
          producer_active_at?: string | null
          producer_disconnected_at?: string | null
          producer_input_enabled?: boolean
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_recording_key?: string | null
          r2_recording_size?: number | null
          r2_video_url?: string | null
          recording_acquired_at?: string | null
          recording_error?: string | null
          recording_error_code?: string | null
          recording_error_message?: string | null
          recording_files?: Json
          recording_last_query_at?: string | null
          recording_provider?: string
          recording_ready_at?: string | null
          recording_resource_id?: string | null
          recording_retry_count?: number
          recording_sid?: string | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_stop_requested_at?: string | null
          recording_stopped_at?: string | null
          recording_uid?: number | null
          replay_post_created_at?: string | null
          replay_post_id?: string | null
          replay_url?: string | null
          resource_id?: string | null
          rtmp_ended_at?: string | null
          rtmp_started_at?: string | null
          rtmp_status?: string | null
          rtmps_url?: string | null
          sid?: string | null
          source?: string | null
          source_connected_at?: string | null
          started_at?: string
          status?: string
          stop_requested_at?: string | null
          stopped_at?: string | null
          storage_provider?: string | null
          stream_deleted_at?: string | null
          stream_key?: string | null
          stream_key_encrypted?: string | null
          stream_key_last_reset_at?: string | null
          stream_key_last_shown_at?: string | null
          stream_provider?: string
          temp_bucket?: string | null
          temp_object_key?: string | null
          thumbnail_url?: string | null
          title?: string
          total_duration_seconds?: number | null
          updated_at?: string
          user_id?: string | null
          viewer_count?: number
          watchdog_stop_result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_live_post_id_fkey"
            columns: ["live_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_replay_post_id_fkey"
            columns: ["replay_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_viewer_presence: {
        Row: {
          client_state: string
          created_at: string
          device_type: string
          id: string
          joined_at: string
          last_seen_at: string
          left_at: string | null
          live_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_state?: string
          created_at?: string
          device_type?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          left_at?: string | null
          live_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_state?: string
          created_at?: string
          device_type?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          left_at?: string | null
          live_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_viewer_presence_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_viewer_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_viewer_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      livestreams: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_eligible: boolean | null
          started_at: string
          stream_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meditation_post_log: {
        Row: {
          chat_id: string
          created_at: string
          error: string | null
          id: string
          message_id: number | null
          sent_date: string
          slot: string
          status: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          error?: string | null
          id?: string
          message_id?: number | null
          sent_date: string
          slot: string
          status: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          error?: string | null
          id?: string
          message_id?: number | null
          sent_date?: string
          slot?: string
          status?: string
        }
        Relationships: []
      }
      meditation_schedule_config: {
        Row: {
          enabled: boolean
          facebook_url: string | null
          funprofile_url: string | null
          id: string
          image_path: string | null
          image_prompt: string
          send_times_vn: string[]
          target_chat_ids: string[]
          telegram_url: string
          topic_en: string
          topic_vi: string
          updated_at: string
          updated_by: string | null
          x_url: string | null
          youtube_community_url: string | null
          youtube_happy_url: string | null
          zoom_id: string
          zoom_pw: string
          zoom_url: string
        }
        Insert: {
          enabled?: boolean
          facebook_url?: string | null
          funprofile_url?: string | null
          id?: string
          image_path?: string | null
          image_prompt?: string
          send_times_vn?: string[]
          target_chat_ids?: string[]
          telegram_url?: string
          topic_en?: string
          topic_vi?: string
          updated_at?: string
          updated_by?: string | null
          x_url?: string | null
          youtube_community_url?: string | null
          youtube_happy_url?: string | null
          zoom_id?: string
          zoom_pw?: string
          zoom_url?: string
        }
        Update: {
          enabled?: boolean
          facebook_url?: string | null
          funprofile_url?: string | null
          id?: string
          image_path?: string | null
          image_prompt?: string
          send_times_vn?: string[]
          target_chat_ids?: string[]
          telegram_url?: string
          topic_en?: string
          topic_vi?: string
          updated_at?: string
          updated_by?: string | null
          x_url?: string | null
          youtube_community_url?: string | null
          youtube_happy_url?: string | null
          zoom_id?: string
          zoom_pw?: string
          zoom_url?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          media_urls: Json | null
          message_type: string
          metadata: Json
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          allowed_scopes: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          platform_name: string | null
          redirect_uris: string[]
          updated_at: string
          webhook_url: string | null
          website_url: string | null
        }
        Insert: {
          allowed_scopes?: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Update: {
          allowed_scopes?: string[]
          client_id?: string
          client_name?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      oauth_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string | null
          code_challenge_method: string | null
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          redirect_uri: string
          scope: string[]
          user_id: string
        }
        Insert: {
          client_id: string
          code: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri: string
          scope?: string[]
          user_id: string
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          identifier: string
          is_used: boolean
          max_attempts: number
          type: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Relationships: []
      }
      pending_provisions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          fun_profile_id: string | null
          id: string
          merge_request_id: string | null
          password_token_hash: string
          platform_data: Json | null
          platform_id: string
          platform_user_id: string | null
          status: string | null
          token_expires_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash: string
          platform_data?: Json | null
          platform_id: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash?: string
          platform_data?: Json | null
          platform_id?: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_provisions_merge_request_id_fkey"
            columns: ["merge_request_id"]
            isOneToOne: false
            referencedRelation: "account_merge_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_financial_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          id: string
          last_sync_at: string
          sync_count: number
          total_bet: number
          total_deposit: number
          total_loss: number
          total_profit: number
          total_win: number
          total_withdraw: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_user_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          data: Json
          id: string
          last_sync_mode: string | null
          sync_count: number
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          cloudflare_deleted_at: string | null
          content: string
          created_at: string
          delete_attempts: number
          delete_completed_at: string | null
          delete_error: string | null
          delete_metadata: Json
          delete_requested_at: string | null
          delete_status: string
          deleted_at: string | null
          download_mp4_parts: Json
          id: string
          image_url: string | null
          location: string | null
          media_urls: Json | null
          metadata: Json
          post_type: string
          r2_deleted_at: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          visibility: string
        }
        Insert: {
          cloudflare_deleted_at?: string | null
          content: string
          created_at?: string
          delete_attempts?: number
          delete_completed_at?: string | null
          delete_error?: string | null
          delete_metadata?: Json
          delete_requested_at?: string | null
          delete_status?: string
          deleted_at?: string | null
          download_mp4_parts?: Json
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          metadata?: Json
          post_type?: string
          r2_deleted_at?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          visibility?: string
        }
        Update: {
          cloudflare_deleted_at?: string | null
          content?: string
          created_at?: string
          delete_attempts?: number
          delete_completed_at?: string | null
          delete_error?: string | null
          delete_metadata?: Json
          delete_requested_at?: string | null
          delete_status?: string
          deleted_at?: string | null
          download_mp4_parts?: Json
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          metadata?: Json
          post_type?: string
          r2_deleted_at?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_cache: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          approved_reward: number
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          cross_platform_data: Json | null
          custodial_wallet_address: string | null
          default_wallet_type: string | null
          display_name: string | null
          email: string | null
          email_claimed: string | null
          email_verified_at: string | null
          external_wallet_address: string | null
          financial_updated_at: string | null
          full_name: string | null
          fun_id: string | null
          grand_total_bet: number
          grand_total_deposit: number
          grand_total_loss: number
          grand_total_profit: number
          grand_total_win: number
          grand_total_withdraw: number
          has_password_set: boolean | null
          id: string
          is_banned: boolean
          is_restricted: boolean
          language: string | null
          last_login_platform: string | null
          last_wallet_changed_at: string | null
          law_of_light_accepted: boolean
          law_of_light_accepted_at: string | null
          oauth_provider: string | null
          pending_reward: number
          pinned_post_id: string | null
          registered_from: string | null
          reward_status: string
          soul_level: number
          synced_with_fun_api_at: string | null
          telegram_2fa_enabled: boolean
          telegram_chat_id: string | null
          telegram_linked_at: string | null
          telegram_username: string | null
          total_rewards: number
          trust_level: number
          updated_at: string
          username: string
          wallet_address: string | null
          wallet_verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          display_name?: string | null
          email?: string | null
          email_claimed?: string | null
          email_verified_at?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          has_password_set?: boolean | null
          id: string
          is_banned?: boolean
          is_restricted?: boolean
          language?: string | null
          last_login_platform?: string | null
          last_wallet_changed_at?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          synced_with_fun_api_at?: string | null
          telegram_2fa_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          total_rewards?: number
          trust_level?: number
          updated_at?: string
          username: string
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          display_name?: string | null
          email?: string | null
          email_claimed?: string | null
          email_verified_at?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          has_password_set?: boolean | null
          id?: string
          is_banned?: boolean
          is_restricted?: boolean
          language?: string | null
          last_login_platform?: string | null
          last_wallet_changed_at?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          synced_with_fun_api_at?: string | null
          telegram_2fa_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          total_rewards?: number
          trust_level?: number
          updated_at?: string
          username?: string
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pinned_post_id_fkey"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_state: {
        Row: {
          count: number
          expires_at: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          expires_at: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_logs: {
        Row: {
          auto_adjusted: boolean | null
          discrepancies: Json | null
          id: string
          level: number
          notes: string | null
          run_at: string
          run_by: string | null
          status: string
          total_checked: number | null
          total_mismatched: number | null
        }
        Insert: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Update: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Relationships: []
      }
      red_envelope_claims: {
        Row: {
          amount: number
          claimed_at: string
          claimer_id: string
          envelope_id: string
          id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          claimer_id: string
          envelope_id: string
          id?: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          claimer_id?: string
          envelope_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_envelope_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "red_envelopes"
            referencedColumns: ["id"]
          },
        ]
      }
      red_envelopes: {
        Row: {
          conversation_id: string
          created_at: string
          creator_id: string
          expires_at: string
          greeting: string | null
          id: string
          message_id: string | null
          remaining_amount: number
          remaining_count: number
          status: string
          token: string
          total_amount: number
          total_count: number
        }
        Insert: {
          conversation_id: string
          created_at?: string
          creator_id: string
          expires_at?: string
          greeting?: string | null
          id?: string
          message_id?: string | null
          remaining_amount: number
          remaining_count: number
          status?: string
          token?: string
          total_amount: number
          total_count: number
        }
        Update: {
          conversation_id?: string
          created_at?: string
          creator_id?: string
          expires_at?: string
          greeting?: string | null
          id?: string
          message_id?: string | null
          remaining_amount?: number
          remaining_count?: number
          status?: string
          token?: string
          total_amount?: number
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "red_envelopes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          details: string | null
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restream_api_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          duration_ms: number | null
          endpoint: string | null
          error_code: string | null
          error_message: string | null
          id: string
          live_session_id: string | null
          method: string | null
          status_code: number | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          duration_ms?: number | null
          endpoint?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          live_session_id?: string | null
          method?: string | null
          status_code?: number | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          duration_ms?: number | null
          endpoint?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          live_session_id?: string | null
          method?: string | null
          status_code?: number | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      restream_channels: {
        Row: {
          channel_url: string | null
          created_at: string
          display_name: string | null
          enabled: boolean
          id: string
          last_synced_at: string | null
          platform: string | null
          platform_id: number | null
          raw: Json | null
          restream_channel_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_url?: string | null
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          last_synced_at?: string | null
          platform?: string | null
          platform_id?: number | null
          raw?: Json | null
          restream_channel_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_url?: string | null
          created_at?: string
          display_name?: string | null
          enabled?: boolean
          id?: string
          last_synced_at?: string | null
          platform?: string | null
          platform_id?: number | null
          raw?: Json | null
          restream_channel_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restream_connections: {
        Row: {
          access_token_encrypted: string
          created_at: string
          expires_at: string
          id: string
          refresh_token_encrypted: string
          restream_user_id: string | null
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token_encrypted: string
          restream_user_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token_encrypted?: string
          restream_user_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restream_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          redirect_after: string | null
          state_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          redirect_after?: string | null
          state_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_after?: string | null
          state_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reward_adjustments: {
        Row: {
          admin_id: string
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_approvals: {
        Row: {
          admin_id: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      reward_pending: {
        Row: {
          action_type: string
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: string
          unlock_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          unlock_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          unlock_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_pending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_pending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          search_query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          search_query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          search_query?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_posts: {
        Row: {
          created_at: string
          id: string
          original_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      siwe_nonces: {
        Row: {
          address: string
          created_at: string
          expires_at: string
          id: string
          nonce: string
          used_at: string | null
        }
        Insert: {
          address: string
          created_at?: string
          expires_at: string
          id?: string
          nonce: string
          used_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          used_at?: string | null
        }
        Relationships: []
      }
      soul_nfts: {
        Row: {
          chain_id: number
          contract_address: string | null
          created_at: string
          experience_points: number
          id: string
          is_minted: boolean
          metadata_uri: string | null
          minted_at: string | null
          soul_element: string | null
          soul_level: number
          soul_name: string | null
          token_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_packs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_free: boolean
          name: string
          preview_url: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name: string
          preview_url: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name?: string
          preview_url?: string
          sort_order?: number
        }
        Relationships: []
      }
      stickers: {
        Row: {
          created_at: string
          id: string
          is_animated: boolean
          name: string
          pack_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_animated?: boolean
          name: string
          pack_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_animated?: boolean
          name?: string
          pack_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stickers_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "sticker_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          created_at: string
          duration: number | null
          id: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: []
      }
      telegram_ai_audit: {
        Row: {
          ai_responded: boolean
          created_at: string
          extra: Json | null
          group_id: number
          id: string
          prompt_preview: string | null
          response_time_ms: number | null
          trigger_source: string
          user_id: number | null
          username: string | null
        }
        Insert: {
          ai_responded?: boolean
          created_at?: string
          extra?: Json | null
          group_id: number
          id?: string
          prompt_preview?: string | null
          response_time_ms?: number | null
          trigger_source: string
          user_id?: number | null
          username?: string | null
        }
        Update: {
          ai_responded?: boolean
          created_at?: string
          extra?: Json | null
          group_id?: number
          id?: string
          prompt_preview?: string | null
          response_time_ms?: number | null
          trigger_source?: string
          user_id?: number | null
          username?: string | null
        }
        Relationships: []
      }
      telegram_ai_conversations: {
        Row: {
          bot_reply: string | null
          chat_id: number | null
          chat_type: string | null
          created_at: string
          error: string | null
          full_name: string | null
          group_id: number | null
          id: string
          language: string | null
          latency_ms: number | null
          message_id: number | null
          provider: string | null
          reply_message_id: number | null
          source: string
          trigger_source: string | null
          user_id: number | null
          user_message: string
          username: string | null
          web_conversation_id: string | null
          web_user_id: string | null
        }
        Insert: {
          bot_reply?: string | null
          chat_id?: number | null
          chat_type?: string | null
          created_at?: string
          error?: string | null
          full_name?: string | null
          group_id?: number | null
          id?: string
          language?: string | null
          latency_ms?: number | null
          message_id?: number | null
          provider?: string | null
          reply_message_id?: number | null
          source?: string
          trigger_source?: string | null
          user_id?: number | null
          user_message: string
          username?: string | null
          web_conversation_id?: string | null
          web_user_id?: string | null
        }
        Update: {
          bot_reply?: string | null
          chat_id?: number | null
          chat_type?: string | null
          created_at?: string
          error?: string | null
          full_name?: string | null
          group_id?: number | null
          id?: string
          language?: string | null
          latency_ms?: number | null
          message_id?: number | null
          provider?: string | null
          reply_message_id?: number | null
          source?: string
          trigger_source?: string | null
          user_id?: number | null
          user_message?: string
          username?: string | null
          web_conversation_id?: string | null
          web_user_id?: string | null
        }
        Relationships: []
      }
      telegram_ai_message_locks: {
        Row: {
          created_at: string
          extra: Json | null
          group_id: number
          id: string
          message_id: number
          prompt_preview: string | null
          status: string
          trigger_source: string
          updated_at: string
          user_id: number | null
        }
        Insert: {
          created_at?: string
          extra?: Json | null
          group_id: number
          id?: string
          message_id: number
          prompt_preview?: string | null
          status?: string
          trigger_source: string
          updated_at?: string
          user_id?: number | null
        }
        Update: {
          created_at?: string
          extra?: Json | null
          group_id?: number
          id?: string
          message_id?: number
          prompt_preview?: string | null
          status?: string
          trigger_source?: string
          updated_at?: string
          user_id?: number | null
        }
        Relationships: []
      }
      telegram_ai_priority_rules: {
        Row: {
          category: string
          created_at: string
          group_id: number | null
          group_replies_per_day: number | null
          group_replies_per_hour: number | null
          id: string
          is_active: boolean
          is_unlimited: boolean
          priority: number
          replies_per_day: number | null
          replies_per_minute: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          group_id?: number | null
          group_replies_per_day?: number | null
          group_replies_per_hour?: number | null
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          priority: number
          replies_per_day?: number | null
          replies_per_minute?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          group_id?: number | null
          group_replies_per_day?: number | null
          group_replies_per_hour?: number | null
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          priority?: number
          replies_per_day?: number | null
          replies_per_minute?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          group_id: number
          hit_count: number
          id: string
          intent: string
          knowledge_version: number
          language: string | null
          last_hit_at: string | null
          model: string | null
          prompt_hash: string
          prompt_preview: string | null
          provider: string | null
          response_text: string
          token_estimate_saved: number
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          group_id: number
          hit_count?: number
          id?: string
          intent: string
          knowledge_version?: number
          language?: string | null
          last_hit_at?: string | null
          model?: string | null
          prompt_hash: string
          prompt_preview?: string | null
          provider?: string | null
          response_text: string
          token_estimate_saved?: number
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          group_id?: number
          hit_count?: number
          id?: string
          intent?: string
          knowledge_version?: number
          language?: string | null
          last_hit_at?: string | null
          model?: string | null
          prompt_hash?: string
          prompt_preview?: string | null
          provider?: string | null
          response_text?: string
          token_estimate_saved?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_ai_restyle_cache: {
        Row: {
          cache_key: string
          created_at: string
          hit_count: number
          last_hit_at: string
          restyled_text: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          hit_count?: number
          last_hit_at?: string
          restyled_text: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          hit_count?: number
          last_hit_at?: string
          restyled_text?: string
        }
        Relationships: []
      }
      telegram_ai_runtime_logs: {
        Row: {
          allowed: boolean
          cache_hit: boolean
          created_at: string
          error: string | null
          estimated_cost: number | null
          extra: Json | null
          group_id: number
          id: string
          input_tokens: number | null
          intent: string
          knowledge_used: boolean
          latency_ms: number | null
          message_id: number | null
          message_type: string | null
          model: string | null
          output_tokens: number | null
          priority: number
          prompt_hash: string | null
          prompt_preview: string | null
          provider: string | null
          rate_limit_category: string | null
          retrieval_time_ms: number | null
          tool_used: string | null
          user_id: number | null
        }
        Insert: {
          allowed?: boolean
          cache_hit?: boolean
          created_at?: string
          error?: string | null
          estimated_cost?: number | null
          extra?: Json | null
          group_id: number
          id?: string
          input_tokens?: number | null
          intent: string
          knowledge_used?: boolean
          latency_ms?: number | null
          message_id?: number | null
          message_type?: string | null
          model?: string | null
          output_tokens?: number | null
          priority: number
          prompt_hash?: string | null
          prompt_preview?: string | null
          provider?: string | null
          rate_limit_category?: string | null
          retrieval_time_ms?: number | null
          tool_used?: string | null
          user_id?: number | null
        }
        Update: {
          allowed?: boolean
          cache_hit?: boolean
          created_at?: string
          error?: string | null
          estimated_cost?: number | null
          extra?: Json | null
          group_id?: number
          id?: string
          input_tokens?: number | null
          intent?: string
          knowledge_used?: boolean
          latency_ms?: number | null
          message_id?: number | null
          message_type?: string | null
          model?: string | null
          output_tokens?: number | null
          priority?: number
          prompt_hash?: string | null
          prompt_preview?: string | null
          provider?: string | null
          rate_limit_category?: string | null
          retrieval_time_ms?: number | null
          tool_used?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      telegram_ai_user_modes: {
        Row: {
          created_at: string
          expires_at: string
          group_id: number
          id: string
          last_activity_at: string
          metadata: Json | null
          mode: string
          updated_at: string
          user_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          group_id: number
          id?: string
          last_activity_at?: string
          metadata?: Json | null
          mode: string
          updated_at?: string
          user_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          group_id?: number
          id?: string
          last_activity_at?: string
          metadata?: Json | null
          mode?: string
          updated_at?: string
          user_id?: number
        }
        Relationships: []
      }
      telegram_bot_dm_events: {
        Row: {
          bot_reply_to_message_id: number | null
          chat_id: number
          command: string | null
          created_at: string
          direction: string
          id: number
          kind: string
          media_caption: string | null
          media_file_id: string | null
          media_kind: string | null
          media_mime: string | null
          message_id: number | null
          telegram_user_id: number
          text_preview: string | null
        }
        Insert: {
          bot_reply_to_message_id?: number | null
          chat_id: number
          command?: string | null
          created_at?: string
          direction?: string
          id?: number
          kind: string
          media_caption?: string | null
          media_file_id?: string | null
          media_kind?: string | null
          media_mime?: string | null
          message_id?: number | null
          telegram_user_id: number
          text_preview?: string | null
        }
        Update: {
          bot_reply_to_message_id?: number | null
          chat_id?: number
          command?: string | null
          created_at?: string
          direction?: string
          id?: number
          kind?: string
          media_caption?: string | null
          media_file_id?: string | null
          media_kind?: string | null
          media_mime?: string | null
          message_id?: number | null
          telegram_user_id?: number
          text_preview?: string | null
        }
        Relationships: []
      }
      telegram_bot_dm_users: {
        Row: {
          chat_id: number
          created_at: string
          first_name: string | null
          first_seen_at: string
          language_code: string | null
          last_command: string | null
          last_message_text: string | null
          last_name: string | null
          last_seen_at: string
          linked_user_id: string | null
          message_count: number
          telegram_user_id: number
          updated_at: string
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          first_name?: string | null
          first_seen_at?: string
          language_code?: string | null
          last_command?: string | null
          last_message_text?: string | null
          last_name?: string | null
          last_seen_at?: string
          linked_user_id?: string | null
          message_count?: number
          telegram_user_id: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          first_name?: string | null
          first_seen_at?: string
          language_code?: string | null
          last_command?: string | null
          last_message_text?: string | null
          last_name?: string | null
          last_seen_at?: string
          linked_user_id?: string | null
          message_count?: number
          telegram_user_id?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_dm_users_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_bot_dm_users_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_community_blocked_keywords: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          language: string | null
          meaning_en: string | null
          meaning_vi: string | null
          risk_note_en: string | null
          risk_note_vi: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          language?: string | null
          meaning_en?: string | null
          meaning_vi?: string | null
          risk_note_en?: string | null
          risk_note_vi?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          language?: string | null
          meaning_en?: string | null
          meaning_vi?: string | null
          risk_note_en?: string | null
          risk_note_vi?: string | null
          severity?: string
        }
        Relationships: []
      }
      telegram_community_domain_whitelist: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      telegram_community_moderation_logs: {
        Row: {
          action: string
          created_at: string
          group_id: number
          id: string
          message_id: number | null
          message_text: string | null
          reason: string
          telegram_user_id: number | null
          username: string | null
        }
        Insert: {
          action: string
          created_at?: string
          group_id: number
          id?: string
          message_id?: number | null
          message_text?: string | null
          reason: string
          telegram_user_id?: number | null
          username?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          group_id?: number
          id?: string
          message_id?: number | null
          message_text?: string | null
          reason?: string
          telegram_user_id?: number | null
          username?: string | null
        }
        Relationships: []
      }
      telegram_community_quick_replies: {
        Row: {
          created_at: string
          disable_web_page_preview: boolean
          id: string
          is_active: boolean
          label: string
          parse_mode: string
          patterns: string[]
          reply_text: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          disable_web_page_preview?: boolean
          id?: string
          is_active?: boolean
          label: string
          parse_mode?: string
          patterns?: string[]
          reply_text: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          disable_web_page_preview?: boolean
          id?: string
          is_active?: boolean
          label?: string
          parse_mode?: string
          patterns?: string[]
          reply_text?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_community_settings: {
        Row: {
          account_shop_action: string
          account_shop_guard_enabled: boolean
          ai_dm_prompt: string | null
          ai_enabled: boolean
          ai_group_replies_per_day: number
          ai_group_replies_per_hour: number
          ai_knowledge_version: number
          ai_max_messages_per_minute: number
          ai_mirror_angel_web: boolean
          ai_persona_prompt: string | null
          ai_response_cache_ttl_hours: number
          ai_style_prompt: string | null
          ai_system_prompt: string
          ai_user_replies_per_day: number
          ai_user_replies_per_minute: number
          always_reply_admins: boolean
          always_reply_on_mention: boolean
          always_reply_on_reply_to_bot: boolean
          always_reply_owner: boolean
          anti_link_enabled: boolean
          anti_spam_enabled: boolean
          block_external_bots: boolean
          block_scam_keywords: boolean
          block_shock_content: boolean
          block_telegram_previews: boolean
          bot_username: string | null
          caption_operator_ids: number[] | null
          cjk_chatter_guard_enabled: boolean
          cjk_chatter_strike_threshold: number
          community_personality: string
          community_support_prompt: string | null
          created_at: string
          enable_ocr_scan: boolean
          event_assistant_enabled: boolean
          event_assistant_prompt: string | null
          event_followup_enabled: boolean
          event_followup_prompt: string | null
          fun_core_context_prompt: string | null
          group_id: number
          group_primary_language: string
          help_intent_ai_enabled: boolean
          help_intent_prompt: string | null
          id: string
          join_guard_action: string
          join_guard_avatar_enabled: boolean
          join_guard_avatar_threshold: string
          join_guard_name_allowlist: string
          join_guard_name_enabled: boolean
          join_guard_name_keywords: string
          max_messages_per_minute: number
          meditation_summary_enabled: boolean
          meditation_summary_max_age_minutes: number
          meditation_summary_prompt: string | null
          meditation_summary_sender_scope: string
          member_alerts_chat_id: string | null
          member_alerts_enabled: boolean
          member_alerts_min_severity: string
          mini_app_builder_timeout_minutes: number
          mini_app_url: string
          mute_duration_minutes: number
          new_user_restriction_hours: number
          owner_anonymous_address_prompt: string | null
          persona_custom_prompt: string | null
          persona_mode: string
          positive_engagement_cooldown_minutes: number
          positive_engagement_enabled: boolean
          positive_engagement_max_per_day: number
          positive_engagement_max_per_hour: number
          positive_engagement_prompt: string | null
          reply_language: string
          rules_message: string
          scam_protection_enabled: boolean
          scam_strict_mode: boolean
          scam_warning_enabled: boolean
          updated_at: string
          verification_enabled: boolean
          verification_failed_message: string
          verification_failure_action: string
          verification_max_attempts: number
          verification_prompt_message: string
          verification_success_message: string
          verification_timeout_seconds: number
          warning_before_ban: number
          warning_before_mute: number
          welcome_enabled: boolean
          welcome_message: string
        }
        Insert: {
          account_shop_action?: string
          account_shop_guard_enabled?: boolean
          ai_dm_prompt?: string | null
          ai_enabled?: boolean
          ai_group_replies_per_day?: number
          ai_group_replies_per_hour?: number
          ai_knowledge_version?: number
          ai_max_messages_per_minute?: number
          ai_mirror_angel_web?: boolean
          ai_persona_prompt?: string | null
          ai_response_cache_ttl_hours?: number
          ai_style_prompt?: string | null
          ai_system_prompt?: string
          ai_user_replies_per_day?: number
          ai_user_replies_per_minute?: number
          always_reply_admins?: boolean
          always_reply_on_mention?: boolean
          always_reply_on_reply_to_bot?: boolean
          always_reply_owner?: boolean
          anti_link_enabled?: boolean
          anti_spam_enabled?: boolean
          block_external_bots?: boolean
          block_scam_keywords?: boolean
          block_shock_content?: boolean
          block_telegram_previews?: boolean
          bot_username?: string | null
          caption_operator_ids?: number[] | null
          cjk_chatter_guard_enabled?: boolean
          cjk_chatter_strike_threshold?: number
          community_personality?: string
          community_support_prompt?: string | null
          created_at?: string
          enable_ocr_scan?: boolean
          event_assistant_enabled?: boolean
          event_assistant_prompt?: string | null
          event_followup_enabled?: boolean
          event_followup_prompt?: string | null
          fun_core_context_prompt?: string | null
          group_id: number
          group_primary_language?: string
          help_intent_ai_enabled?: boolean
          help_intent_prompt?: string | null
          id?: string
          join_guard_action?: string
          join_guard_avatar_enabled?: boolean
          join_guard_avatar_threshold?: string
          join_guard_name_allowlist?: string
          join_guard_name_enabled?: boolean
          join_guard_name_keywords?: string
          max_messages_per_minute?: number
          meditation_summary_enabled?: boolean
          meditation_summary_max_age_minutes?: number
          meditation_summary_prompt?: string | null
          meditation_summary_sender_scope?: string
          member_alerts_chat_id?: string | null
          member_alerts_enabled?: boolean
          member_alerts_min_severity?: string
          mini_app_builder_timeout_minutes?: number
          mini_app_url?: string
          mute_duration_minutes?: number
          new_user_restriction_hours?: number
          owner_anonymous_address_prompt?: string | null
          persona_custom_prompt?: string | null
          persona_mode?: string
          positive_engagement_cooldown_minutes?: number
          positive_engagement_enabled?: boolean
          positive_engagement_max_per_day?: number
          positive_engagement_max_per_hour?: number
          positive_engagement_prompt?: string | null
          reply_language?: string
          rules_message?: string
          scam_protection_enabled?: boolean
          scam_strict_mode?: boolean
          scam_warning_enabled?: boolean
          updated_at?: string
          verification_enabled?: boolean
          verification_failed_message?: string
          verification_failure_action?: string
          verification_max_attempts?: number
          verification_prompt_message?: string
          verification_success_message?: string
          verification_timeout_seconds?: number
          warning_before_ban?: number
          warning_before_mute?: number
          welcome_enabled?: boolean
          welcome_message?: string
        }
        Update: {
          account_shop_action?: string
          account_shop_guard_enabled?: boolean
          ai_dm_prompt?: string | null
          ai_enabled?: boolean
          ai_group_replies_per_day?: number
          ai_group_replies_per_hour?: number
          ai_knowledge_version?: number
          ai_max_messages_per_minute?: number
          ai_mirror_angel_web?: boolean
          ai_persona_prompt?: string | null
          ai_response_cache_ttl_hours?: number
          ai_style_prompt?: string | null
          ai_system_prompt?: string
          ai_user_replies_per_day?: number
          ai_user_replies_per_minute?: number
          always_reply_admins?: boolean
          always_reply_on_mention?: boolean
          always_reply_on_reply_to_bot?: boolean
          always_reply_owner?: boolean
          anti_link_enabled?: boolean
          anti_spam_enabled?: boolean
          block_external_bots?: boolean
          block_scam_keywords?: boolean
          block_shock_content?: boolean
          block_telegram_previews?: boolean
          bot_username?: string | null
          caption_operator_ids?: number[] | null
          cjk_chatter_guard_enabled?: boolean
          cjk_chatter_strike_threshold?: number
          community_personality?: string
          community_support_prompt?: string | null
          created_at?: string
          enable_ocr_scan?: boolean
          event_assistant_enabled?: boolean
          event_assistant_prompt?: string | null
          event_followup_enabled?: boolean
          event_followup_prompt?: string | null
          fun_core_context_prompt?: string | null
          group_id?: number
          group_primary_language?: string
          help_intent_ai_enabled?: boolean
          help_intent_prompt?: string | null
          id?: string
          join_guard_action?: string
          join_guard_avatar_enabled?: boolean
          join_guard_avatar_threshold?: string
          join_guard_name_allowlist?: string
          join_guard_name_enabled?: boolean
          join_guard_name_keywords?: string
          max_messages_per_minute?: number
          meditation_summary_enabled?: boolean
          meditation_summary_max_age_minutes?: number
          meditation_summary_prompt?: string | null
          meditation_summary_sender_scope?: string
          member_alerts_chat_id?: string | null
          member_alerts_enabled?: boolean
          member_alerts_min_severity?: string
          mini_app_builder_timeout_minutes?: number
          mini_app_url?: string
          mute_duration_minutes?: number
          new_user_restriction_hours?: number
          owner_anonymous_address_prompt?: string | null
          persona_custom_prompt?: string | null
          persona_mode?: string
          positive_engagement_cooldown_minutes?: number
          positive_engagement_enabled?: boolean
          positive_engagement_max_per_day?: number
          positive_engagement_max_per_hour?: number
          positive_engagement_prompt?: string | null
          reply_language?: string
          rules_message?: string
          scam_protection_enabled?: boolean
          scam_strict_mode?: boolean
          scam_warning_enabled?: boolean
          updated_at?: string
          verification_enabled?: boolean
          verification_failed_message?: string
          verification_failure_action?: string
          verification_max_attempts?: number
          verification_prompt_message?: string
          verification_success_message?: string
          verification_timeout_seconds?: number
          warning_before_ban?: number
          warning_before_mute?: number
          welcome_enabled?: boolean
          welcome_message?: string
        }
        Relationships: []
      }
      telegram_community_user_state: {
        Row: {
          ai_msg_count: number
          ai_window_start: string
          banned_at: string | null
          created_at: string
          full_name: string | null
          group_id: number
          id: string
          joined_at: string
          message_count: number
          message_count_window_start: string
          muted_until: string | null
          telegram_user_id: number
          updated_at: string
          username: string | null
          warning_count: number
        }
        Insert: {
          ai_msg_count?: number
          ai_window_start?: string
          banned_at?: string | null
          created_at?: string
          full_name?: string | null
          group_id: number
          id?: string
          joined_at?: string
          message_count?: number
          message_count_window_start?: string
          muted_until?: string | null
          telegram_user_id: number
          updated_at?: string
          username?: string | null
          warning_count?: number
        }
        Update: {
          ai_msg_count?: number
          ai_window_start?: string
          banned_at?: string | null
          created_at?: string
          full_name?: string | null
          group_id?: number
          id?: string
          joined_at?: string
          message_count?: number
          message_count_window_start?: string
          muted_until?: string | null
          telegram_user_id?: number
          updated_at?: string
          username?: string | null
          warning_count?: number
        }
        Relationships: []
      }
      telegram_community_verification_challenges: {
        Row: {
          attempts: number
          captcha_message_id: number | null
          correct_answer: number
          created_at: string
          expires_at: string
          full_name: string | null
          group_id: number
          id: string
          max_attempts: number
          options: number[]
          question: string
          status: string
          telegram_user_id: number
          updated_at: string
          username: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          captcha_message_id?: number | null
          correct_answer: number
          created_at?: string
          expires_at: string
          full_name?: string | null
          group_id: number
          id?: string
          max_attempts?: number
          options: number[]
          question: string
          status?: string
          telegram_user_id: number
          updated_at?: string
          username?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          captcha_message_id?: number | null
          correct_answer?: number
          created_at?: string
          expires_at?: string
          full_name?: string | null
          group_id?: number
          id?: string
          max_attempts?: number
          options?: number[]
          question?: string
          status?: string
          telegram_user_id?: number
          updated_at?: string
          username?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      telegram_event_messages: {
        Row: {
          chat_id: number
          created_at: string
          event_date: string | null
          event_time: string | null
          event_type: string
          host_name: string | null
          id: string
          language: string | null
          livestream_links: Json
          message_id: number
          raw_text: string | null
          sender_chat_id: number | null
          sender_user_id: number | null
          status: string
          timezone: string | null
          title: string | null
          topic: string | null
          updated_at: string
          zoom_id: string | null
          zoom_link: string | null
          zoom_password: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          event_type: string
          host_name?: string | null
          id?: string
          language?: string | null
          livestream_links?: Json
          message_id: number
          raw_text?: string | null
          sender_chat_id?: number | null
          sender_user_id?: number | null
          status?: string
          timezone?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          zoom_id?: string | null
          zoom_link?: string | null
          zoom_password?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          event_type?: string
          host_name?: string | null
          id?: string
          language?: string | null
          livestream_links?: Json
          message_id?: number
          raw_text?: string | null
          sender_chat_id?: number | null
          sender_user_id?: number | null
          status?: string
          timezone?: string | null
          title?: string | null
          topic?: string | null
          updated_at?: string
          zoom_id?: string | null
          zoom_link?: string | null
          zoom_password?: string | null
        }
        Relationships: []
      }
      telegram_feedback: {
        Row: {
          admin_note: string | null
          chat_id: number | null
          chat_title: string | null
          content: string
          created_at: string
          display_name: string | null
          id: number
          message_id: number | null
          reply_to_message_id: number | null
          reply_to_preview: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          telegram_user_id: number | null
          username: string | null
        }
        Insert: {
          admin_note?: string | null
          chat_id?: number | null
          chat_title?: string | null
          content: string
          created_at?: string
          display_name?: string | null
          id?: number
          message_id?: number | null
          reply_to_message_id?: number | null
          reply_to_preview?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          status?: string
          telegram_user_id?: number | null
          username?: string | null
        }
        Update: {
          admin_note?: string | null
          chat_id?: number | null
          chat_title?: string | null
          content?: string
          created_at?: string
          display_name?: string | null
          id?: number
          message_id?: number | null
          reply_to_message_id?: number | null
          reply_to_preview?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          telegram_user_id?: number | null
          username?: string | null
        }
        Relationships: []
      }
      telegram_group_config: {
        Row: {
          ai_enabled: boolean
          always_reply_admins: boolean
          always_reply_on_mention: boolean
          always_reply_on_reply_to_bot: boolean
          always_reply_owner: boolean
          created_at: string
          father_channel_id: number | null
          father_channel_title: string | null
          group_id: number
          group_title: string | null
          id: string
          moderation_level: string
          mute_minutes: number
          strike_threshold: number
          updated_at: string
          welcome_message: string
        }
        Insert: {
          ai_enabled?: boolean
          always_reply_admins?: boolean
          always_reply_on_mention?: boolean
          always_reply_on_reply_to_bot?: boolean
          always_reply_owner?: boolean
          created_at?: string
          father_channel_id?: number | null
          father_channel_title?: string | null
          group_id: number
          group_title?: string | null
          id?: string
          moderation_level?: string
          mute_minutes?: number
          strike_threshold?: number
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          ai_enabled?: boolean
          always_reply_admins?: boolean
          always_reply_on_mention?: boolean
          always_reply_on_reply_to_bot?: boolean
          always_reply_owner?: boolean
          created_at?: string
          father_channel_id?: number | null
          father_channel_title?: string | null
          group_id?: number
          group_title?: string | null
          id?: string
          moderation_level?: string
          mute_minutes?: number
          strike_threshold?: number
          updated_at?: string
          welcome_message?: string
        }
        Relationships: []
      }
      telegram_group_health: {
        Row: {
          bot_reply_count_total: number
          group_id: number
          group_title: string | null
          help_intent_count_total: number
          inbound_count_total: number
          last_bot_reply_at: string | null
          last_bot_reply_mode: string | null
          last_inbound_at: string | null
          last_inbound_text: string | null
          last_inbound_user: string | null
          updated_at: string
        }
        Insert: {
          bot_reply_count_total?: number
          group_id: number
          group_title?: string | null
          help_intent_count_total?: number
          inbound_count_total?: number
          last_bot_reply_at?: string | null
          last_bot_reply_mode?: string | null
          last_inbound_at?: string | null
          last_inbound_text?: string | null
          last_inbound_user?: string | null
          updated_at?: string
        }
        Update: {
          bot_reply_count_total?: number
          group_id?: number
          group_title?: string | null
          help_intent_count_total?: number
          inbound_count_total?: number
          last_bot_reply_at?: string | null
          last_bot_reply_mode?: string | null
          last_inbound_at?: string | null
          last_inbound_text?: string | null
          last_inbound_user?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_group_mutes: {
        Row: {
          created_at: string
          group_id: number
          id: string
          muted_until: string
          reason: string | null
          tg_user_id: number
          tg_username: string | null
        }
        Insert: {
          created_at?: string
          group_id: number
          id?: string
          muted_until: string
          reason?: string | null
          tg_user_id: number
          tg_username?: string | null
        }
        Update: {
          created_at?: string
          group_id?: number
          id?: string
          muted_until?: string
          reason?: string | null
          tg_user_id?: number
          tg_username?: string | null
        }
        Relationships: []
      }
      telegram_group_strikes: {
        Row: {
          created_at: string
          group_id: number
          id: string
          last_violation_at: string
          strike_count: number
          tg_user_id: number
          tg_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: number
          id?: string
          last_violation_at?: string
          strike_count?: number
          tg_user_id: number
          tg_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: number
          id?: string
          last_violation_at?: string
          strike_count?: number
          tg_user_id?: number
          tg_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_group_violations: {
        Row: {
          action_taken: string
          ai_score: Json | null
          created_at: string
          group_id: number
          id: string
          message_id: number | null
          message_text: string | null
          reason: string
          tg_user_id: number | null
          tg_username: string | null
        }
        Insert: {
          action_taken: string
          ai_score?: Json | null
          created_at?: string
          group_id: number
          id?: string
          message_id?: number | null
          message_text?: string | null
          reason: string
          tg_user_id?: number | null
          tg_username?: string | null
        }
        Update: {
          action_taken?: string
          ai_score?: Json | null
          created_at?: string
          group_id?: number
          id?: string
          message_id?: number | null
          message_text?: string | null
          reason?: string
          tg_user_id?: number | null
          tg_username?: string | null
        }
        Relationships: []
      }
      telegram_history_backfill: {
        Row: {
          chat_id: number
          chat_title: string | null
          chat_username: string | null
          created_at: string | null
          cursor_min_id: number | null
          id: string
          last_error: string | null
          phone_code_hash: string | null
          session_string: string | null
          status: string | null
          total_ingested: number | null
          total_seen: number | null
          updated_at: string | null
        }
        Insert: {
          chat_id: number
          chat_title?: string | null
          chat_username?: string | null
          created_at?: string | null
          cursor_min_id?: number | null
          id?: string
          last_error?: string | null
          phone_code_hash?: string | null
          session_string?: string | null
          status?: string | null
          total_ingested?: number | null
          total_seen?: number | null
          updated_at?: string | null
        }
        Update: {
          chat_id?: number
          chat_title?: string | null
          chat_username?: string | null
          created_at?: string | null
          cursor_min_id?: number | null
          id?: string
          last_error?: string | null
          phone_code_hash?: string | null
          session_string?: string | null
          status?: string | null
          total_ingested?: number | null
          total_seen?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_invite_link_stats: {
        Row: {
          chat_id: number
          created_at: string
          current_members: number
          invite_link: string
          invite_link_name: string | null
          last_used_at: string | null
          left_within_7d: number
          total_joins: number
          updated_at: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          current_members?: number
          invite_link: string
          invite_link_name?: string | null
          last_used_at?: string | null
          left_within_7d?: number
          total_joins?: number
          updated_at?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          current_members?: number
          invite_link?: string
          invite_link_name?: string | null
          last_used_at?: string | null
          left_within_7d?: number
          total_joins?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_join_avatar_scans: {
        Row: {
          created_at: string
          file_unique_id: string
          reason: string | null
          score: number
          updated_at: string
          verdict: string
        }
        Insert: {
          created_at?: string
          file_unique_id: string
          reason?: string | null
          score?: number
          updated_at?: string
          verdict: string
        }
        Update: {
          created_at?: string
          file_unique_id?: string
          reason?: string | null
          score?: number
          updated_at?: string
          verdict?: string
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_link_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_meditation_replies: {
        Row: {
          chat_id: number
          id: string
          message_id: number
          replied_at: string
        }
        Insert: {
          chat_id: number
          id?: string
          message_id: number
          replied_at?: string
        }
        Update: {
          chat_id?: number
          id?: string
          message_id?: number
          replied_at?: string
        }
        Relationships: []
      }
      telegram_member_daily_stats: {
        Row: {
          banned_count: number
          chat_id: number
          created_at: string
          joined_count: number
          kicked_count: number
          left_count: number
          net_growth: number
          rejoined_count: number
          stat_date: string
          top_invite_links: Json
          total_members: number | null
          unbanned_count: number
          updated_at: string
        }
        Insert: {
          banned_count?: number
          chat_id: number
          created_at?: string
          joined_count?: number
          kicked_count?: number
          left_count?: number
          net_growth?: number
          rejoined_count?: number
          stat_date: string
          top_invite_links?: Json
          total_members?: number | null
          unbanned_count?: number
          updated_at?: string
        }
        Update: {
          banned_count?: number
          chat_id?: number
          created_at?: string
          joined_count?: number
          kicked_count?: number
          left_count?: number
          net_growth?: number
          rejoined_count?: number
          stat_date?: string
          top_invite_links?: Json
          total_members?: number | null
          unbanned_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_member_events: {
        Row: {
          admin_actor_tg_id: number | null
          admin_actor_username: string | null
          chat_id: number
          claimed_at: string | null
          created_at: string
          delivery_started_at: string | null
          delivery_state: string | null
          display_name: string | null
          event_type: string
          id: string
          invite_link: string | null
          invite_link_name: string | null
          invited_by_tg_id: number | null
          invited_by_username: string | null
          join_outcome: string | null
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          metadata: Json
          new_status: string | null
          occurred_at: string
          old_status: string | null
          processed_at: string | null
          processing_attempts: number
          processing_status: string | null
          tg_user_id: number
          username: string | null
        }
        Insert: {
          admin_actor_tg_id?: number | null
          admin_actor_username?: string | null
          chat_id: number
          claimed_at?: string | null
          created_at?: string
          delivery_started_at?: string | null
          delivery_state?: string | null
          display_name?: string | null
          event_type: string
          id?: string
          invite_link?: string | null
          invite_link_name?: string | null
          invited_by_tg_id?: number | null
          invited_by_username?: string | null
          join_outcome?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          metadata?: Json
          new_status?: string | null
          occurred_at?: string
          old_status?: string | null
          processed_at?: string | null
          processing_attempts?: number
          processing_status?: string | null
          tg_user_id: number
          username?: string | null
        }
        Update: {
          admin_actor_tg_id?: number | null
          admin_actor_username?: string | null
          chat_id?: number
          claimed_at?: string | null
          created_at?: string
          delivery_started_at?: string | null
          delivery_state?: string | null
          display_name?: string | null
          event_type?: string
          id?: string
          invite_link?: string | null
          invite_link_name?: string | null
          invited_by_tg_id?: number | null
          invited_by_username?: string | null
          join_outcome?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          metadata?: Json
          new_status?: string | null
          occurred_at?: string
          old_status?: string | null
          processed_at?: string | null
          processing_attempts?: number
          processing_status?: string | null
          tg_user_id?: number
          username?: string | null
        }
        Relationships: []
      }
      telegram_moderation_notice_events: {
        Row: {
          created_at: string
          group_id: number
          message_id: number
        }
        Insert: {
          created_at?: string
          group_id: number
          message_id: number
        }
        Update: {
          created_at?: string
          group_id?: number
          message_id?: number
        }
        Relationships: []
      }
      telegram_moderation_notice_groups: {
        Row: {
          group_id: number
          last_claimed_at: string | null
        }
        Insert: {
          group_id: number
          last_claimed_at?: string | null
        }
        Update: {
          group_id?: number
          last_claimed_at?: string | null
        }
        Relationships: []
      }
      telegram_otp_challenges: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          first_factor: string
          id: string
          max_attempts: number
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          first_factor: string
          id?: string
          max_attempts?: number
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          first_factor?: string
          id?: string
          max_attempts?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_otp_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_otp_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_scheduled_deletions: {
        Row: {
          chat_id: number
          created_at: string
          delete_at: string
          message_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          delete_at: string
          message_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          delete_at?: string
          message_id?: number
        }
        Relationships: []
      }
      telegram_spam_prelude: {
        Row: {
          created_at: string
          group_id: number
          id: string
          kind: string
          message_id: number | null
          user_id: number
        }
        Insert: {
          created_at?: string
          group_id: number
          id?: string
          kind: string
          message_id?: number | null
          user_id: number
        }
        Update: {
          created_at?: string
          group_id?: number
          id?: string
          kind?: string
          message_id?: number | null
          user_id?: number
        }
        Relationships: []
      }
      telegram_unauthorized_bot_invites: {
        Row: {
          bot_id: number
          claimed_at: string
          event_date: number
          group_id: number
          update_id: number
        }
        Insert: {
          bot_id: number
          claimed_at?: string
          event_date: number
          group_id: number
          update_id: number
        }
        Update: {
          bot_id?: number
          claimed_at?: string
          event_date?: number
          group_id?: number
          update_id?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: string
          chain_id: number
          created_at: string
          from_address: string
          id: string
          status: string
          to_address: string
          token_address: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Insert: {
          amount: string
          chain_id: number
          created_at?: string
          from_address: string
          id?: string
          status?: string
          to_address: string
          token_address?: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Update: {
          amount?: string
          chain_id?: number
          created_at?: string
          from_address?: string
          id?: string
          status?: string
          to_address?: string
          token_address?: string | null
          token_symbol?: string
          tx_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      trusted_bot_usernames: {
        Row: {
          added_by: string | null
          chat_id: number | null
          created_at: string
          id: string
          username: string
        }
        Insert: {
          added_by?: string | null
          chat_id?: number | null
          created_at?: string
          id?: string
          username: string
        }
        Update: {
          added_by?: string | null
          chat_id?: number | null
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      trusted_sender_chats: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          sender_chat_id: number
          title: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          sender_chat_id: number
          title?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          sender_chat_id?: number
          title?: string | null
        }
        Relationships: []
      }
      trusted_telegram_handles: {
        Row: {
          added_by: string | null
          chat_id: number | null
          created_at: string
          handle: string
          id: string
          note: string | null
        }
        Insert: {
          added_by?: string | null
          chat_id?: number | null
          created_at?: string
          handle: string
          id?: string
          note?: string | null
        }
        Update: {
          added_by?: string | null
          chat_id?: number | null
          created_at?: string
          handle?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      user_action_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_action_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_action_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_fingerprint: {
        Row: {
          created_at: string
          device_hash: string
          id: string
          ip_hash: string
          user_agent_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          id?: string
          ip_hash: string
          user_agent_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          id?: string
          ip_hash?: string
          user_agent_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_fingerprint_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_fingerprint_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stake_status: {
        Row: {
          created_at: string
          fun_balance: number
          last_checked_at: string | null
          meets_requirement: boolean
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          fun_balance?: number
          last_checked_at?: string | null
          meets_requirement?: boolean
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          fun_balance?: number
          last_checked_at?: string | null
          meets_requirement?: boolean
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stake_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stake_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trust: {
        Row: {
          account_age_score: number
          engagement_score: number
          fingerprint_penalty: number
          flag_reason: string | null
          is_flagged: boolean
          report_penalty: number
          trust_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_age_score?: number
          engagement_score?: number
          fingerprint_penalty?: number
          flag_reason?: string | null
          is_flagged?: boolean
          report_penalty?: number
          trust_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_age_score?: number
          engagement_score?: number
          fingerprint_penalty?: number
          flag_reason?: string | null
          is_flagged?: boolean
          report_penalty?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trust_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_trust_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          address: string
          chain_id: number | null
          created_at: string
          id: string
          is_primary: boolean
          user_id: string
          verified_at: string | null
          wallet_network: string
        }
        Insert: {
          address: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id: string
          verified_at?: string | null
          wallet_network?: string
        }
        Update: {
          address?: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id?: string
          verified_at?: string | null
          wallet_network?: string
        }
        Relationships: []
      }
      wallet_auth_attempts: {
        Row: {
          address: string | null
          attempt_type: string
          created_at: string
          id: string
          ip_hash: string | null
          reason: string | null
          success: boolean
          ua_hash: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          attempt_type: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason?: string | null
          success: boolean
          ua_hash?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          attempt_type?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason?: string | null
          success?: boolean
          ua_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_links: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          id: string
          label: string | null
          last_seen_at: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          address: string
          chain_id: number
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_nonces: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          expires_at: string
          id: string
          issued_at: string
          nonce: string
          purpose: string | null
          requested_by_user_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          address: string
          chain_id: number
          created_at?: string
          expires_at: string
          id?: string
          issued_at?: string
          nonce: string
          purpose?: string | null
          requested_by_user_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          expires_at?: string
          id?: string
          issued_at?: string
          nonce?: string
          purpose?: string | null
          requested_by_user_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_nonces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_nonces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_rate_limits: {
        Row: {
          count: number
          created_at: string
          expires_at: string
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          expires_at: string
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          expires_at?: string
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_custodial_wallets: {
        Row: {
          chain_id: number | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_activity_at: string | null
          updated_at: string | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      attach_live_replay_to_post: {
        Args: {
          _duration_seconds?: number
          _playback_url: string
          _session_id: string
          _thumbnail_url?: string
        }
        Returns: {
          agora_channel: string | null
          agora_uid: number | null
          agora_uid_host: number | null
          archive_bucket: string | null
          archive_error: string | null
          archive_object_key: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          browser_recording_chunk_count: number
          browser_recording_status: string
          browser_recording_total_bytes: number
          browser_recording_warning: string | null
          channel_name: string
          cleanup_attempts: number
          cleanup_finished_at: string | null
          cleanup_started_at: string | null
          client_state: string | null
          cloudflare_live_input_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          cloudflare_video_uid: string | null
          created_at: string
          description: string | null
          disconnect_detected_at: string | null
          download_mp4_parts: Json
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          error_message: string | null
          go_live_clicked_at: string | null
          heartbeat_agora_channel_name: string | null
          heartbeat_count: number
          heartbeat_device_type: string | null
          heartbeat_source_type: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_connection_status: string
          host_heartbeat_at: string | null
          host_user_id: string
          id: string
          last_cleanup_at: string | null
          last_heartbeat_at: string | null
          last_host_heartbeat_at: string | null
          last_media_activity_at: string | null
          last_recording_query_at: string | null
          last_recording_query_result: Json
          last_seen_at: string | null
          last_viewer_activity_at: string | null
          last_worker_response: Json | null
          live_mode: string
          live_post_id: string | null
          mode: string | null
          owner_id: string | null
          playback_provider: string | null
          playback_url: string | null
          post_id: string | null
          privacy: string
          processing_started_at: string | null
          producer_active_at: string | null
          producer_disconnected_at: string | null
          producer_input_enabled: boolean
          r2_bucket: string | null
          r2_object_key: string | null
          r2_recording_key: string | null
          r2_recording_size: number | null
          r2_video_url: string | null
          recording_acquired_at: string | null
          recording_error: string | null
          recording_error_code: string | null
          recording_error_message: string | null
          recording_files: Json
          recording_last_query_at: string | null
          recording_provider: string
          recording_ready_at: string | null
          recording_resource_id: string | null
          recording_retry_count: number
          recording_sid: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stop_requested_at: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          replay_post_created_at: string | null
          replay_post_id: string | null
          replay_url: string | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          rtmps_url: string | null
          sid: string | null
          source: string | null
          source_connected_at: string | null
          started_at: string
          status: string
          stop_requested_at: string | null
          stopped_at: string | null
          storage_provider: string | null
          stream_deleted_at: string | null
          stream_key: string | null
          stream_key_encrypted: string | null
          stream_key_last_reset_at: string | null
          stream_key_last_shown_at: string | null
          stream_provider: string
          temp_bucket: string | null
          temp_object_key: string | null
          thumbnail_url: string | null
          title: string
          total_duration_seconds: number | null
          updated_at: string
          user_id: string | null
          viewer_count: number
          watchdog_stop_result: Json
        }
        SetofOptions: {
          from: "*"
          to: "live_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ban_user_permanently: {
        Args: { p_admin_id: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      calculate_engagement_quality: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_trust_score: { Args: { p_user_id: string }; Returns: number }
      can_user_message: { Args: { p_receiver_id: string }; Returns: boolean }
      check_action_rate_limit: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_ms?: number }
        Returns: Json
      }
      claim_red_envelope: { Args: { p_envelope_id: string }; Returns: number }
      cleanup_expired_oauth_data: { Args: never; Returns: undefined }
      consume_otp_code: {
        Args: { p_code: string; p_identifier: string; p_otp_id: string }
        Returns: string
      }
      decrement_live_viewer_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      delete_storage_object: {
        Args: { bucket_name: string; object_path: string }
        Returns: undefined
      }
      detect_device_clusters: {
        Args: never
        Returns: {
          device_hash: string
          user_count: number
          user_ids: string[]
          usernames: string[]
        }[]
      }
      end_livestream: { Args: { p_livestream_id: string }; Returns: boolean }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      fun_game_assign_daily_quests: { Args: never; Returns: Json }
      fun_game_claim_daily_reward: {
        Args: { p_daily_quest_id: string }
        Returns: Json
      }
      fun_game_ensure_profile: { Args: never; Returns: Json }
      fun_game_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          light_score: number
          streak_days: number
          user_id: string
          username: string
          xp: number
        }[]
      }
      fun_game_open_next_box: { Args: never; Returns: Json }
      fun_game_pet_action: { Args: { p_action: string }; Returns: Json }
      fun_game_player_summary: { Args: never; Returns: Json }
      fun_game_track_action: {
        Args: { p_increment?: number; p_proof?: Json; p_quest_code: string }
        Returns: Json
      }
      fun_game_track_demo_action: {
        Args: { p_daily_quest_id: string; p_increment?: number }
        Returns: Json
      }
      generate_secure_token: { Args: { length?: number }; Returns: string }
      get_app_stats: {
        Args: never
        Returns: {
          total_photos: number
          total_posts: number
          total_rewards: number
          total_users: number
          total_videos: number
        }[]
      }
      get_live_recording_context: {
        Args: { _session_id: string }
        Returns: {
          agora_channel: string
          channel_name: string
          host_user_id: string
          id: string
          last_worker_response: Json
          post_id: string
          recording_error: string
          recording_ready_at: string
          recording_started_at: string
          recording_status: string
          recording_stopped_at: string
          recording_uid: number
          resource_id: string
          sid: string
        }[]
      }
      get_live_session_credentials: {
        Args: { _session_id: string }
        Returns: {
          rtmps_url: string
          stream_key: string
        }[]
      }
      get_user_rewards: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          total_reward: number
          username: string
        }[]
      }
      get_user_rewards_v2: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          livestreams_count: number
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          today_reward: number
          total_reward: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_live_viewer_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      is_conversation_admin: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      log_user_action: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: Json
      }
      mark_live_replay_uploaded: {
        Args: { _replay_id: string }
        Returns: undefined
      }
      normalize_username: { Args: { input_text: string }; Returns: string }
      pin_message: { Args: { p_message_id: string }; Returns: undefined }
      recalculate_user_financial:
        | { Args: { p_client_id?: string; p_user_id: string }; Returns: Json }
        | {
            Args: {
              p_admin_id?: string
              p_client_id?: string
              p_user_id: string
            }
            Returns: Json
          }
      reject_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      run_financial_reconciliation: {
        Args: { p_admin_id?: string }
        Returns: Json
      }
      set_live_recording_state: {
        Args: {
          _last_worker_response?: Json
          _recording_error?: string
          _recording_ready_at?: string
          _recording_started_at?: string
          _recording_status?: string
          _recording_stopped_at?: string
          _recording_uid?: number
          _resource_id?: string
          _session_id: string
          _sid?: string
        }
        Returns: {
          agora_channel: string | null
          agora_uid: number | null
          agora_uid_host: number | null
          archive_bucket: string | null
          archive_error: string | null
          archive_object_key: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          browser_recording_chunk_count: number
          browser_recording_status: string
          browser_recording_total_bytes: number
          browser_recording_warning: string | null
          channel_name: string
          cleanup_attempts: number
          cleanup_finished_at: string | null
          cleanup_started_at: string | null
          client_state: string | null
          cloudflare_live_input_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          cloudflare_video_uid: string | null
          created_at: string
          description: string | null
          disconnect_detected_at: string | null
          download_mp4_parts: Json
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          error_message: string | null
          go_live_clicked_at: string | null
          heartbeat_agora_channel_name: string | null
          heartbeat_count: number
          heartbeat_device_type: string | null
          heartbeat_source_type: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_connection_status: string
          host_heartbeat_at: string | null
          host_user_id: string
          id: string
          last_cleanup_at: string | null
          last_heartbeat_at: string | null
          last_host_heartbeat_at: string | null
          last_media_activity_at: string | null
          last_recording_query_at: string | null
          last_recording_query_result: Json
          last_seen_at: string | null
          last_viewer_activity_at: string | null
          last_worker_response: Json | null
          live_mode: string
          live_post_id: string | null
          mode: string | null
          owner_id: string | null
          playback_provider: string | null
          playback_url: string | null
          post_id: string | null
          privacy: string
          processing_started_at: string | null
          producer_active_at: string | null
          producer_disconnected_at: string | null
          producer_input_enabled: boolean
          r2_bucket: string | null
          r2_object_key: string | null
          r2_recording_key: string | null
          r2_recording_size: number | null
          r2_video_url: string | null
          recording_acquired_at: string | null
          recording_error: string | null
          recording_error_code: string | null
          recording_error_message: string | null
          recording_files: Json
          recording_last_query_at: string | null
          recording_provider: string
          recording_ready_at: string | null
          recording_resource_id: string | null
          recording_retry_count: number
          recording_sid: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stop_requested_at: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          replay_post_created_at: string | null
          replay_post_id: string | null
          replay_url: string | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          rtmps_url: string | null
          sid: string | null
          source: string | null
          source_connected_at: string | null
          started_at: string
          status: string
          stop_requested_at: string | null
          stopped_at: string | null
          storage_provider: string | null
          stream_deleted_at: string | null
          stream_key: string | null
          stream_key_encrypted: string | null
          stream_key_last_reset_at: string | null
          stream_key_last_shown_at: string | null
          stream_provider: string
          temp_bucket: string | null
          temp_object_key: string | null
          thumbnail_url: string | null
          title: string
          total_duration_seconds: number | null
          updated_at: string
          user_id: string | null
          viewer_count: number
          watchdog_stop_result: Json
        }
        SetofOptions: {
          from: "*"
          to: "live_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_live_recording_stopped: {
        Args: { _file_list?: Json; _media_url?: string; _session_id: string }
        Returns: undefined
      }
      sync_profiles_legacy_wallet_fields: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      telegram_group_health_inbound: {
        Args: {
          p_group_id: number
          p_group_title: string
          p_help_intent: boolean
          p_text: string
          p_user: string
        }
        Returns: undefined
      }
      telegram_group_health_reply: {
        Args: { p_group_id: number; p_mode: string }
        Returns: undefined
      }
      tg_begin_join_delivery: {
        Args: { p_id: string; p_token: string }
        Returns: boolean
      }
      tg_claim_join_event: {
        Args: { p_id: string; p_lease_seconds?: number }
        Returns: string
      }
      tg_claim_moderation_failure_notice: {
        Args: { p_group_id: number; p_message_id: number }
        Returns: string
      }
      tg_claim_unauthorized_bot_invite: {
        Args: {
          p_bot_id: number
          p_event_date: number
          p_group_id: number
          p_update_id: number
        }
        Returns: string
      }
      tg_finish_join_event: {
        Args: {
          p_delivery?: string
          p_error?: string
          p_id: string
          p_outcome: string
          p_status: string
          p_token: string
        }
        Returns: boolean
      }
      tg_mark_join_event_review: {
        Args: { p_id: string; p_reason: string }
        Returns: boolean
      }
      tg_record_join_event: {
        Args: {
          p_chat_id: number
          p_event_type: string
          p_occurred_at: string
          p_row: Json
          p_tg_user_id: number
        }
        Returns: {
          id: string
          inserted: boolean
          processing_status: string
        }[]
      }
      tg_renew_join_lease: {
        Args: { p_id: string; p_seconds: number; p_token: string }
        Returns: boolean
      }
      tg_sweep_join_events: { Args: never; Returns: number }
      unpin_message: { Args: { p_message_id: string }; Returns: undefined }
      upsert_live_recording_row: {
        Args: {
          _duration_seconds?: number
          _file_list_json?: Json
          _media_url?: string
          _raw_response?: Json
          _recorder_uid?: string
          _resource_id?: string
          _session_id: string
          _sid?: string
          _status?: string
          _stopped_at?: string
          _thumbnail_url?: string
        }
        Returns: {
          created_at: string | null
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          file_list_json: Json | null
          id: string
          live_id: string | null
          media_url: string | null
          mode: string | null
          raw_response: Json | null
          recorder_uid: string | null
          resource_id: string | null
          sid: string | null
          status: string | null
          stopped_at: string | null
          storage_region: number | null
          storage_vendor: number | null
          thumbnail_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "live_recordings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
      fun_game_event_type:
        | "daily_light_quest"
        | "treasure_hunt"
        | "ai_pet"
        | "mystery_box"
        | "referral"
        | "season"
      fun_game_rarity: "common" | "rare" | "epic" | "legendary" | "cosmic"
      fun_game_reward_status: "pending" | "approved" | "rejected" | "paid"
      fun_game_reward_type:
        | "fun_money"
        | "camly_coin"
        | "xp"
        | "light_score"
        | "nft_badge"
        | "nft_item"
        | "mystery_box"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      fun_game_event_type: [
        "daily_light_quest",
        "treasure_hunt",
        "ai_pet",
        "mystery_box",
        "referral",
        "season",
      ],
      fun_game_rarity: ["common", "rare", "epic", "legendary", "cosmic"],
      fun_game_reward_status: ["pending", "approved", "rejected", "paid"],
      fun_game_reward_type: [
        "fun_money",
        "camly_coin",
        "xp",
        "light_score",
        "nft_badge",
        "nft_item",
        "mystery_box",
      ],
    },
  },
} as const
