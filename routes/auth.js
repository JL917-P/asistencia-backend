import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const router = express.Router();

/* -----------------------------------------------------------
   Normalización de username
----------------------------------------------------------- */
const normalizeUsername = u =>
  (u || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

/* -----------------------------------------------------------
   Fijar RP_ID y ORIGEN sin saltos de línea
----------------------------------------------------------- */
const clean = v => (v || "").trim().replace(/\n/g, "");
const RP_ID = clean(process.env.RP_ID);
const EMP_ORIGIN = clean(process.env.EMPLOYEE_ORIGIN_FULL);
const makeUUID = () => crypto.randomUUID();

/* Storage temporal */
const regChallenges = new Map();
const authChallenges = new Map();

/* ===========================================================
   1. REGISTER BEGIN
=========================================================== */
router.post('/register-begin', async (req, res) => {
  try {
    let { username, displayName } = req.body;
    username = normalizeUsername(username);

    if (!username)
      return res.status(400).json({ error: 'username required' });

    const u = await pool.query(
      'SELECT * FROM users WHERE LOWER(username)=LOWER($1)',
      [username]
    );

    let userId;
    if (u.rows.length) {
      userId = u.rows[0].id;
    } else {
      userId = makeUUID();
      await pool.query(
        'INSERT INTO users (id, username, display_name) VALUES ($1,$2,$3)',
        [userId, username, displayName || username]
      );
    }

    const creds = await pool.query(
      'SELECT credential_id FROM credentials WHERE user_id=$1',
      [userId]
    );

    const exclude = creds.rows.map(r => ({
      id: Buffer.from(r.credential_id, 'base64url'),
      type: 'public-key',
    }));

    const options = generateRegistrationOptions({
      rpName: 'Asistencia',
      rpID: RP_ID,
      userID: userId,
      userName: username,
      userDisplayName: displayName || username,
      attestationType: 'none',
      authenticatorSelection: { userVerification: 'preferred' },
      excludeCredentials: exclude,
    });

    regChallenges.set(userId, options.challenge);

    return res.json({ options, userId });

  } catch (e) {
    console.error("❌ register-begin error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
   2. REGISTER COMPLETE
=========================================================== */
router.post('/register-complete', async (req, res) => {
  try {
    const { userId, attestation, origin } = req.body;
    const expectedChallenge = regChallenges.get(userId);

    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge,
      expectedOrigin: origin || EMP_ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified)
      return res.status(400).json({ verified: false });

    const { credentialPublicKey, credentialID, counter } =
      verification.registrationInfo;

    const credIdBase64 = Buffer.from(credentialID).toString('base64url');

    await pool.query(
      `INSERT INTO credentials (id, user_id, credential_id, public_key, sign_count)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (credential_id) DO UPDATE
       SET public_key=$4, sign_count=$5`,
      [
        makeUUID(),
        userId,
        credIdBase64,
        credentialPublicKey.toString('base64'),
        counter,
      ]
    );

    regChallenges.delete(userId);

    return res.json({ verified: true });

  } catch (e) {
    console.error("❌ register-complete error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
   3. AUTH BEGIN
=========================================================== */
router.post('/auth-begin', async (req, res) => {
  try {
    let { username } = req.body;
    username = normalizeUsername(username);

    const u = await pool.query(
      'SELECT * FROM users WHERE LOWER(username)=LOWER($1)',
      [username]
    );

    if (!u.rows.length)
      return res.status(404).json({ error: 'user not found' });

    const userId = u.rows[0].id;

    const rows = await pool.query(
      'SELECT credential_id FROM credentials WHERE user_id=$1',
      [userId]
    );

    const allowCredentials = rows.rows.map(r => ({
      id: Buffer.from(r.credential_id, 'base64url'),
      type: 'public-key',
    }));

    const options = generateAuthenticationOptions({
      timeout: 60000,
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    });

    authChallenges.set(userId, options.challenge);

    return res.json({
      options,
      userId,
      displayName: u.rows[0].display_name,
    });

  } catch (e) {
    console.error("❌ auth-begin error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
   4. AUTH COMPLETE
=========================================================== */
router.post('/auth-complete', async (req, res) => {
  try {
    const { userId, assertion, origin } = req.body;

    const cred = await pool.query(
      'SELECT * FROM credentials WHERE user_id=$1 LIMIT 1',
      [userId]
    );

    if (!cred.rows.length)
      return res.status(404).json({ error: 'credential not found' });

    const expectedChallenge = authChallenges.get(userId);

    const { sign_count, public_key, credential_id, id } = cred.rows[0];

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin || EMP_ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: Buffer.from(credential_id, 'base64url'),
        credentialPublicKey: Buffer.from(public_key, 'base64'),
        counter: Number(sign_count),
      },
    });

    if (!verification.verified)
      return res.status(401).json({ verified: false });

    const newCounter = verification.authenticationInfo.newCounter;

    await pool.query(
      'UPDATE credentials SET sign_count=$1 WHERE id=$2',
      [newCounter, id]
    );

    authChallenges.delete(userId);

    return res.json({ verified: true });

  } catch (e) {
    console.error("❌ auth-complete error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* EXPORT */
export default router;
