const ROLE_AGENT_MAP = {
  admin: ['market-research', 'content-rrss'],
  seo: ['market-research'],
  rrss: ['content-rrss'],
};

function canAccessAgent(role, slug) {
  return ROLE_AGENT_MAP[role]?.includes(slug) ?? false;
}

function getAllowedSlugs(role) {
  return ROLE_AGENT_MAP[role] || [];
}

module.exports = { ROLE_AGENT_MAP, canAccessAgent, getAllowedSlugs };
