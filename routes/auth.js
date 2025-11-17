console.log("🔥 auth.js cargado!");

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

/* ===========================================================
   NORMALIZADOR ROBUSTO DE USERNAME
=========================================================== */
const normalizeUsername = u =>
  (u || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

/* ===========================================================
   CONFIG DE ORIGEN Y RP_ID
=========================================================== */
const clean = v => (v || "").trim().replace(/\n/g, "");

// origin declarado en variables de entorno
const EXPECTED_ORIGIN = clean(process.env.EMPLOYEE_ORIGIN_FULL);

// RP_ID debe ser sólo dominio
const RP_ID = EXPECTED_ORIGIN
  .replace("https://", "")
  .replace("http://", "")
  .split("/")[0];

console.log("🔎 WebAuthn config:");
console.log("   ORIGIN:", EXPECTED_ORIGIN);
console.log("   RP_ID :", RP_ID);

/* ===========================================================
   HELPERS
=========================================================== */
const makeUUID = () => crypto.randomUUID();

/* Map para almacenar challenges temporales */
const regChallenges = new Map();
const authChallenges = new Map();

/* ===========================================================
    1. REGISTER BEGIN (crear challenge)
=========================================================== */
router.post('/register-begin', async (req, res) => {
  try {
    let { username, displayName } = req.body;

    username = normalizeUsername(username);
    displayName = (displayName || username).trim();

    if (!username) {
      return res.status(400).json({ error: "username requerido" });
    }

    /* Buscar usuario o crearlo */
    const q = await pool.query(
      "SELECT * FROM users WHERE LOWER(username)=LOWER($1)",
      [username]
    );

    let userId;

    if (q.rows.length) {
      userId = q.rows[0].id;
    } else {
      userId = makeUUID();
      await pool.query(
        "INSERT INTO users (id, username, display_name) VALUES ($1,$2,$3)",
        [userId, username, displayName]
      );
    }

    /* Cargar credenciales previas */
    const creds = await pool.query(
      "SELECT credential_id FROM credentials WHERE user_id=$1",
      [userId]
    );

    const excludeCredentials = creds.rows.map(r => ({
      id: Buffer.from(r.credential_id, "base64url"),
      type: "public-key",
    }));

    /* 🚀 CORRECTO: userID debe ser Buffer */
    const userID_Buffer = Buffer.from(userId, "utf8");

    const options = generateRegistrationOptions({
      rpName: "Asistencia",
      rpID: RP_ID,
      userID: userID_Buffer,      // ⚡ obligatorio
      userName: username,
      userDisplayName: displayName,
      attestationType: "none",
      authenticatorSelection: { userVerification: "preferred" },
      excludeCredentials,
    });

    regChallenges.set(userId, options.challenge);

    return res.json({ options, userId });

  } catch (e) {
    console.error("❌ register-begin error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
    2. REGISTER COMPLETE (verificar attestation)
=========================================================== */
router.post('/register-complete', async (req, res) => {
  try {
    const { userId, attestation } = req.body;

    const expectedChallenge = regChallenges.get(userId);

    if (!expectedChallenge) {
      return res.status(400).json({ error: "challenge expirado" });
    }

    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false });
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
    } = verification.registrationInfo;

    const credentialID_b64url = Buffer.from(credentialID).toString("base64url");

    await pool.query(
      `INSERT INTO credentials
        (id, user_id, credential_id, public_key, sign_count)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (credential_id) DO UPDATE
       SET public_key=$4, sign_count=$5`,
      [
        makeUUID(),
        userId,
        credentialID_b64url,
        credentialPublicKey.toString("base64"),
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
    3. AUTH BEGIN  (crear challenge)
=========================================================== */
router.post('/auth-begin', async (req, res) => {
  try {
    let { username } = req.body;
    username = normalizeUsername(username);

    const user = await pool.query(
      "SELECT * FROM users WHERE LOWER(username)=LOWER($1)",
      [username]
    );

    if (!user.rows.length)
      return res.status(404).json({ error: "user not found" });

    const userId = user.rows[0].id;

    const rows = await pool.query(
      "SELECT credential_id FROM credentials WHERE user_id=$1",
      [userId]
    );

    const allowCredentials = rows.rows.map(r => ({
      id: Buffer.from(r.credential_id, "base64url"),
      type: "public-key",
    }));

    const options = generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      timeout: 60000,
      userVerification: "preferred",
    });

    authChallenges.set(userId, options.challenge);

    return res.json({
      options,
      userId,
      displayName: user.rows[0].display_name,
    });

  } catch (e) {
    console.error("❌ auth-begin error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/* ===========================================================
    4. AUTH COMPLETE (verificar assertion)
=========================================================== */
router.post('/auth-complete', async (req, res) => {
  try {
    const { userId, assertion } = req.body;

    const creds = await pool.query(
      "SELECT * FROM credentials WHERE user_id=$1 LIMIT 1",
      [userId]
    );

    if (!creds.rows.length)
      return res.status(404).json({ error: "credential not found" });

    const expectedChallenge = authChallenges.get(userId);

    const { sign_count, public_key, credential_id, id } = creds.rows[0];

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: Buffer.from(credential_id, "base64url"),
        credentialPublicKey: Buffer.from(public_key, "base64"),
        counter: Number(sign_count),
      },
    });

    if (!verification.verified)
      return res.status(401).json({ verified: false });

    const newCounter = verification.authenticationInfo.newCounter;

    await pool.query(
      "UPDATE credentials SET sign_count=$1 WHERE id=$2",
      [newCounter, id]
    );

    authChallenges.delete(userId);

    return res.json({ verified: true });

  } catch (e) {
    console.error("❌ auth-complete error:", e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
