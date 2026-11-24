export const SIDEBAR_GROUP_IDS = ['group_plan', 'group_analytics', 'group_jars'];

const VIEW_TO_GROUP = {
  plan: 'group_plan',
  analytics: 'group_analytics',
  jars: 'group_jars',
};

export function normalizePinnedGroups(value) {
  return Array.isArray(value) ? SIDEBAR_GROUP_IDS.filter((id) => value.includes(id)) : [];
}

export function groupIdForView(view) {
  return VIEW_TO_GROUP[view] || null;
}
