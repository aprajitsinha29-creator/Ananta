/**
 * Ananta Quantum Studio - Real Authentication Service
 *
 * Replaces the old "local display name" placeholder (which never verified
 * anything - it just wrote whatever name the user typed to localStorage)
 * with genuine server-verified accounts:
 *   - Passwords hashed with scrypt (Node's built-in crypto, no native
 *     dependency), per-user random salt, timing-safe comparison.
 *   - Session tokens are self-contained and signed with HMAC-SHA256 using a
 *     secret generated once with crypto.randomBytes and persisted to disk
 *     (ananta-backend/data/.session_secret, gitignored) - never hardcoded.
 *   - A revocation list (also file-backed) lets /api/auth/logout actually
 *     invalidate a token before its natural expiry, since stateless tokens
 *     can't otherwise be revoked.
 *   - Basic in-memory login-attempt throttling per email to blunt trivial
 *     brute forcing.
 *
 * Storage is a JSON file (ananta-backend/data/users.json), consistent with
 * how the rest of this backend already persists data (instructorStorage.js,
 * assignments.json, cohorts.json, etc) - no new database dependency.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, '.session_secret');
const REVOKED_FILE = path.join(DATA_DIR, '.revoked_sessions.json');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SCRYPT_KEYLEN = 64;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSessionSecret() {
  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) {
    const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (existing) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

// Env var takes precedence for real deployments; otherwise a real secret is
// generated once and persisted locally - never a hardcoded literal.
const SESSION_SECRET = process.env.ANANTA_SESSION_SECRET || loadSessionSecret();

function loadUsers() {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) || [];
  } catch (e) {
    console.error('[AuthService] Corrupt users.json, refusing to overwrite. Error:', e.message);
    throw new Error('User store is unreadable. Contact the server operator.');
  }
}

function saveUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadRevoked() {
  ensureDataDir();
  if (!fs.existsSync(REVOKED_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(REVOKED_FILE, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

function saveRevoked(map) {
  ensureDataDir();
  // Prune expired entries so this file doesn't grow forever.
  const now = Date.now();
  const pruned = {};
  for (const [jti, exp] of Object.entries(map)) {
    if (exp > now) pruned[jti] = exp;
  }
  fs.writeFileSync(REVOKED_FILE, JSON.stringify(pruned));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hashHex] = String(stored || '').split(':');
  if (!salt || !hashHex) return false;
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hashHex, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function sign(payload) {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(json).digest();
  return `${base64url(json)}.${base64url(sig)}`;
}

function issueSessionToken(user) {
  const now = Date.now();
  const payload = {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    jti: crypto.randomBytes(9).toString('hex'),
    iat: now,
    exp: now + SESSION_TTL_MS
  };
  return { token: sign(payload), payload };
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'Malformed session token' };
  }
  const [payloadPart, sigPart] = token.split('.');
  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadPart).toString('utf8'));
  } catch (e) {
    return { valid: false, error: 'Malformed session payload' };
  }

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(JSON.stringify(payload)).digest();
  const actualSig = base64urlDecode(sigPart);
  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    return { valid: false, error: 'Invalid session signature' };
  }
  if (!payload.exp || Date.now() > payload.exp) {
    return { valid: false, error: 'Session expired' };
  }

  const revoked = loadRevoked();
  if (revoked[payload.jti]) {
    return { valid: false, error: 'Session was logged out' };
  }

  return { valid: true, payload };
}

function revokeSessionToken(token) {
  const { valid, payload } = verifySessionToken(token);
  if (!valid || !payload) return false;
  const revoked = loadRevoked();
  revoked[payload.jti] = payload.exp;
  saveRevoked(revoked);
  return true;
}

// --- Login-attempt throttling (in-memory, per server process) ---
const loginAttempts = new Map(); // email -> { count, windowStart }

function checkLoginThrottle(email) {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    return { blocked: false };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterMs = LOGIN_WINDOW_MS - (now - entry.windowStart);
    return { blocked: true, retryAfterMs };
  }
  return { blocked: false };
}

function recordFailedLogin(email) {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(email, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

function clearLoginAttempts(email) {
  loginAttempts.delete(email);
}

// --- Public account operations ---

const VALID_ROLES = new Set(['explorer', 'instructor']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

function registerUser({ name, email, password, role }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanRole = VALID_ROLES.has(role) ? role : 'explorer';

  if (!cleanName) throw new Error('Name is required');
  if (!EMAIL_RE.test(cleanEmail)) throw new Error('A valid email address is required');
  if (!password || String(password).length < 8) throw new Error('Password must be at least 8 characters');

  const users = loadUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error('An account with this email already exists');
  }

  const user = {
    id: 'user_' + crypto.randomBytes(8).toString('hex'),
    name: cleanName,
    email: cleanEmail,
    role: cleanRole,
    passwordHash: hashPassword(String(password)),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);

  const { token } = issueSessionToken(user);
  return { user: publicUser(user), token };
}

function loginUser({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const throttle = checkLoginThrottle(cleanEmail);
  if (throttle.blocked) {
    const err = new Error(`Too many failed login attempts. Try again in ${Math.ceil(throttle.retryAfterMs / 1000)}s.`);
    err.statusCode = 429;
    throw err;
  }

  const users = loadUsers();
  const user = users.find((u) => u.email === cleanEmail);
  if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
    recordFailedLogin(cleanEmail);
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  clearLoginAttempts(cleanEmail);
  const { token } = issueSessionToken(user);
  return { user: publicUser(user), token };
}

function getUserById(uid) {
  const users = loadUsers();
  const user = users.find((u) => u.id === uid);
  return user ? publicUser(user) : null;
}

/**
 * Express/http-agnostic guard: pass the Authorization header value, get back
 * either { ok: true, session } or { ok: false, statusCode, error }.
 * Callers decide what to do (e.g. server.js route handlers).
 */
function requireSession(authorizationHeader) {
  const token = (authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, statusCode: 401, error: 'Missing Authorization: Bearer <token> header' };
  const { valid, payload, error } = verifySessionToken(token);
  if (!valid) return { ok: false, statusCode: 401, error: error || 'Invalid session' };
  return { ok: true, session: payload };
}

function requireRole(authorizationHeader, role) {
  const result = requireSession(authorizationHeader);
  if (!result.ok) return result;
  if (result.session.role !== role) {
    return { ok: false, statusCode: 403, error: `This action requires the '${role}' role` };
  }
  return result;
}

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  verifySessionToken,
  revokeSessionToken,
  requireSession,
  requireRole
};
