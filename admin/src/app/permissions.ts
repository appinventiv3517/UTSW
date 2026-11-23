/* ---------- Roles and permissions ----------
   PROPOSED MATRIX – pending UTSW confirmation (HANDOVER §7, open question in admin/README.md).
   Kept in this one object so the confirmed matrix replaces it without touching screens. */
export type Role = 'superAdmin' | 'admin' | 'marketing';
export const ROLES: Record<Role, { label: string }> = {
  superAdmin: { label: 'Super Admin' },
  admin: { label: 'Admin' },
  marketing: { label: 'Marketing' }
};
/* Levels, lowest to highest. draft = edit drafts and request review; demo = also deploy to demo;
   publish = also publish to production, request changes and roll back; manage = full control (users). */
export const LEVELS = ['none', 'view', 'draft', 'demo', 'publish', 'manage'] as const;
export type Level = typeof LEVELS[number];
export const LEVEL_LABEL: Record<Level, string> = { none: 'No access', view: 'View', draft: 'Edit drafts, request review', demo: 'Edit and deploy to demo', publish: 'Edit and publish', manage: 'Manage' };
export type Area = 'dashboard' | 'analytics' | 'homeLayout' | 'quickLinks' | 'featuredCards' | 'drawer' | 'appEntry' | 'campaigns' | 'alerts' | 'colors' | 'search'
  | 'audiences' | 'wayfinding' | 'notifications' | 'users' | 'audit' | 'platform' | 'adminSettings' | 'locations' | 'facility' | 'profile';
export const PERMISSIONS: { status: string; areas: Record<Exclude<Area, 'profile'>, Record<Role, Level>> } = {
  status: 'Proposed – pending confirmation',
  areas: {
    dashboard: { superAdmin: 'view', admin: 'view', marketing: 'view' },
    analytics: { superAdmin: 'view', admin: 'view', marketing: 'view' },
    homeLayout: { superAdmin: 'publish', admin: 'publish', marketing: 'draft' },
    quickLinks: { superAdmin: 'publish', admin: 'publish', marketing: 'draft' },
    featuredCards: { superAdmin: 'publish', admin: 'publish', marketing: 'draft' },
    drawer: { superAdmin: 'publish', admin: 'publish', marketing: 'draft' },
    appEntry: { superAdmin: 'publish', admin: 'publish', marketing: 'draft' },
    campaigns: { superAdmin: 'publish', admin: 'publish', marketing: 'demo' },
    alerts: { superAdmin: 'publish', admin: 'publish', marketing: 'view' },
    colors: { superAdmin: 'publish', admin: 'view', marketing: 'view' },
    search: { superAdmin: 'publish', admin: 'publish', marketing: 'view' },
    audiences: { superAdmin: 'publish', admin: 'publish', marketing: 'view' },
    wayfinding: { superAdmin: 'publish', admin: 'publish', marketing: 'view' },
    notifications: { superAdmin: 'publish', admin: 'publish', marketing: 'draft' },
    users: { superAdmin: 'manage', admin: 'view', marketing: 'none' },
    audit: { superAdmin: 'publish', admin: 'view', marketing: 'none' },
    platform: { superAdmin: 'publish', admin: 'view', marketing: 'none' },
    adminSettings: { superAdmin: 'publish', admin: 'view', marketing: 'none' },
    locations: { superAdmin: 'publish', admin: 'publish', marketing: 'view' },
    facility: { superAdmin: 'publish', admin: 'publish', marketing: 'draft' }
  }
};
export const levelOf = (role: Role | null | undefined, area: Area): Level =>
  area === 'profile' ? 'manage' : (role && PERMISSIONS.areas[area] ? PERMISSIONS.areas[area][role] : null) || 'none';
export const can = (role: Role | null | undefined, area: Area, need: Level = 'view'): boolean => LEVELS.indexOf(levelOf(role, area)) >= LEVELS.indexOf(need);
/* Lifecycle actions → the level each needs */
export const ACTION_NEEDS = { saveDraft: 'draft', requestReview: 'draft', deployDemo: 'demo', requestChanges: 'publish', publish: 'publish', rollback: 'publish' } as const;
export type Action = keyof typeof ACTION_NEEDS;
export const canAct = (role: Role | null | undefined, area: Area, action: Action): boolean => can(role, area, ACTION_NEEDS[action]);
