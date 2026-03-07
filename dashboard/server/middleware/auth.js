const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Support Bearer header OR query param ?token= (for downloads via window.open)
  const header = req.headers.authorization;
  let token = null;

  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'No tienes permiso para este recurso' });
    next();
  };
}

function requireAgentAccess(fixedSlug) {
  const { canAccessAgent } = require('../config/permissions');
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    const slug = fixedSlug || req.params.slug;
    if (!canAccessAgent(req.user.role, slug)) return res.status(403).json({ error: 'No tienes permiso para este agente' });
    next();
  };
}

authMiddleware.requireRole = requireRole;
authMiddleware.requireAgentAccess = requireAgentAccess;
module.exports = authMiddleware;
