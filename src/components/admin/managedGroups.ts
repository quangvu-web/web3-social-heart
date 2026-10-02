export type ManagedGroupSearchRow = {
  group_id: number;
  group_title?: string | null;
};

export function managedGroupDisplayName(groupTitle: string | null | undefined): string {
  return groupTitle?.trim() || "Chưa có tên nhóm";
}

export function filterManagedGroups<T extends ManagedGroupSearchRow>(groups: T[], query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return groups;

  return groups.filter((group) =>
    managedGroupDisplayName(group.group_title).toLowerCase().includes(normalizedQuery) ||
    String(group.group_id).includes(normalizedQuery)
  );
}

export function hasManagedGroupId(groups: ManagedGroupSearchRow[], groupId: number): boolean {
  return groups.some((group) => group.group_id === groupId);
}
