export const SIDEBAR_GROUP_IDS = ['group_plan', 'group_analytics'];
export const DEFAULT_PINNED_GROUPS = [...SIDEBAR_GROUP_IDS];

const VIEW_TO_GROUP = {
  plan: 'group_plan',
  analytics: 'group_analytics',
};

export function normalizePinnedGroups(value) {
  if (value === undefined) return [...DEFAULT_PINNED_GROUPS];
  return Array.isArray(value) ? SIDEBAR_GROUP_IDS.filter((id) => value.includes(id)) : [];
}

export function groupIdForView(view) {
  return VIEW_TO_GROUP[view] || null;
}
