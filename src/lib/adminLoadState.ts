export type AdminLoadState = "loading" | "error" | "empty" | "success";

export function getAdminLoadState(input: {
  loading: boolean;
  error: boolean;
  loaded: boolean;
  hasRows: boolean;
}): AdminLoadState {
  if (input.loading) return "loading";
  if (input.error || !input.loaded) return "error";
  return input.hasRows ? "success" : "empty";
}

export function canMutateVerifiedAdminData(state: AdminLoadState): boolean {
  return state === "success" || state === "empty";
}
