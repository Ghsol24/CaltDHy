export const SIDEBAR_GROUP_IDS = ['group_plan', 'group_analytics'];

const VIEW_TO_GROUP = {
  plan: 'group_plan',
  analytics: 'group_analytics',
};

export function normalizePinnedGroups(value) {
  return Array.isArray(value) ? SIDEBAR_GROUP_IDS.filter((id) => value.includes(id)) : [];
}

export function groupIdForView(view) {
  return VIEW_TO_GROUP[view] || null;
}
