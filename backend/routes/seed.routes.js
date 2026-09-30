const router = require('express').Router();
const { runSeed } = require('../db/seedRunner');
const jwt = require('jsonwebtoken');

// Secret key for remote triggering on Vercel or cloud deployments
const DEFAULT_SECRET = 'FleetPortalSeed2026';

function verifySecretOrAdmin(req) {
  const configuredSecret = process.env.SEED_SECRET || DEFAULT_SECRET;
  const providedSecret = req.query.secret || req.body?.secret || req.headers['x-seed-secret'];

  // Check secret key first
  if (providedSecret && providedSecret === configuredSecret) {
    return true;
  }

  // Fallback: check if bearer token is an admin
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      if (decoded && decoded.role === 'admin') {
        return true;
      }
    } catch {
      // ignore token verification error
    }
  }

  return false;
}

// GET or POST /api/seed
// Usage 1: Browser navigation -> https://your-domain.vercel.app/api/seed?secret=FleetPortalSeed2026
// Usage 2: POST request with { "secret": "FleetPortalSeed2026" } or header "x-seed-secret: FleetPortalSeed2026"
async function handleSeed(req, res) {
  if (!verifySecretOrAdmin(req)) {
    return res.status(403).json({
      error: 'Forbidden: Invalid or missing seed secret.',
      hint: 'Provide secret via query param (?secret=FleetPortalSeed2026), JSON body ({ "secret": "FleetPortalSeed2026" }), or x-seed-secret header.',
    });
  }

  try {
    const result = await runSeed();
    return res.json({
      status: 'success',
      ...result,
    });
  } catch (err) {
    console.error('Seed execution error:', err);
    return res.status(500).json({
      error: 'Seed failed',
      details: err.message,
    });
  }
}

router.get('/', handleSeed);
router.post('/', handleSeed);

module.exports = router;
