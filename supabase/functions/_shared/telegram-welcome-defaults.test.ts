import assert from "npm:assert@2.1.0";
import { managedGroupSettingsInsert } from "./telegram-welcome-defaults.ts";

Deno.test("new managed group insert explicitly enables welcome without changing CAPTCHA settings", () => {
  assert.deepStrictEqual(managedGroupSettingsInsert(-5267124937, "funrich_community_bot"), {
    group_id: -5267124937,
    bot_username: "funrich_community_bot",
    welcome_enabled: true,
  });
});

Deno.test("welcome backfill migration only changes the welcome flag", async () => {
  const migration = await Deno.readTextFile(
    "supabase/migrations/20261003010000_enable_welcome_for_managed_groups.sql",
  );
  const normalized = migration.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();

  assert.match(
    normalized,
    /^UPDATE public\.telegram_community_settings SET welcome_enabled = TRUE WHERE welcome_enabled IS DISTINCT FROM TRUE;$/i,
  );
});
