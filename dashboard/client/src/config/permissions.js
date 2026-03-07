export const ROLE_AGENT_MAP = {
  admin: ['market-research', 'content-rrss'],
  seo: ['market-research'],
  rrss: ['content-rrss'],
};

export function canAccessAgent(role, slug) {
  return ROLE_AGENT_MAP[role]?.includes(slug) ?? false;
}

export function getAllowedSlugs(role) {
  return ROLE_AGENT_MAP[role] || [];
}
