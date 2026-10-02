export function managedGroupSettingsInsert(groupId: number, botUsername: string | null) {
  return {
    group_id: groupId,
    bot_username: botUsername,
    welcome_enabled: true,
  } as const;
}
