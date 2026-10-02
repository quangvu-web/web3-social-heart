type QueryError = { code?: string; message: string } | null;

export type ManagedGroupBase = { group_id: number };
export type ManagedGroupTitle = { group_id: number; group_title: string | null };

type QueryResult<T> = { data: T[] | null; error: QueryError };

export async function loadManagedGroupTitles<TGroup extends ManagedGroupBase>(params: {
  readAllowlist: () => Promise<QueryResult<TGroup>>;
  readTelegramGroupConfigTitles: (groupIds: number[]) => Promise<QueryResult<ManagedGroupTitle>>;
  onMetadataError: (errorCode?: string) => void;
}): Promise<
  | { success: false; error: string }
  | { success: true; groups: Array<TGroup & { group_title: string | null }>; titleLookupFailed: boolean }
> {
  const allowlistResult = await params.readAllowlist();
  if (allowlistResult.error) return { success: false, error: allowlistResult.error.message };

  const groups = allowlistResult.data ?? [];
  if (groups.length === 0) return { success: true, groups: [], titleLookupFailed: false };

  let titleResult: QueryResult<ManagedGroupTitle>;
  try {
    titleResult = await params.readTelegramGroupConfigTitles(groups.map((group) => group.group_id));
  } catch {
    params.onMetadataError();
    return {
      success: true,
      groups: groups.map((group) => ({ ...group, group_title: null })),
      titleLookupFailed: true,
    };
  }

  if (titleResult.error) {
    params.onMetadataError(titleResult.error.code);
    return {
      success: true,
      groups: groups.map((group) => ({ ...group, group_title: null })),
      titleLookupFailed: true,
    };
  }

  const titleByGroupId = new Map<number, string>();
  for (const row of titleResult.data ?? []) {
    const title = row.group_title?.trim();
    if (title) titleByGroupId.set(row.group_id, title);
  }

  return {
    success: true,
    groups: groups.map((group) => ({ ...group, group_title: titleByGroupId.get(group.group_id) ?? null })),
    titleLookupFailed: false,
  };
}
