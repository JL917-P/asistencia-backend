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

const regChallenges = new Map();
const authChallenges = new Map();

// Variables de entorno necesarias
const RP_ID = process.env.RP_ID;  
const EMP_ORIGIN = process.env.EMPLOYEE_ORIGIN_FULL;

// Función segura para generar UUID
const makeUUID = () => crypto.randomUUID();

/* ---------------------------------------------
   RUTA: INICIAR REGISTRO (REGISTER BEGIN)
----------------------------------------------*/
router.post('/register-begin', async (req, res) => {
  try {
    const { username, displayName } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'username required' });
    }

    // Verificar si el usuario existe
    const u = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    let userId;

    if (u.rows.length) {
      userId = u.rows[0].id; // Usuario existente
    } else {
      userId = makeUUID(); // Usuario nuevo
      await pool.query(
        'INSERT INTO users (id, username, display_name) VALUES ($1,$2,$3)',
        [userId, username, displayName || username]
      );
    }

    // Obtener credenciales previas
    const creds = await pool.query('SELECT credential_id FROM credentials WHERE user_id=$1', [userId]);

    const options = generateRegistrationOptions({
      rpName: 'Asistencia',
      rpID: RP_ID,
      userID: userId,
      userName: username,
      userDisplayName: displayName || username,
      attestationType: 'indirect',
      authenticatorSelection: { userVerification: 'preferred' },
      excludeCredentials: creds.rows.map(r => ({
        id: Buffer.from(r.credential_id, 'base64url'),
        type: 'public-key'
      }))
    });

    // Guardar challenge temporal
    regChallenges.set(userId, options.challenge);

    return res.json({ options, userId });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* ---------------------------------------------
   RUTA: COMPLETAR REGISTRO (REGISTER COMPLETE)
----------------------------------------------*/
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

    if (!verification.verified) {
      return res.status(400).json({ verified: false });
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;
    const credIdBase64 = Buffer.from(credentialID).toString('base64url');

    await pool.query(
      `INSERT INTO credentials (id, user_id, credential_id, public_key, sign_count)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (credential_id) DO UPDATE SET public_key=$4, sign_count=$5`,
      [makeUUID(), userId, credIdBase64, credentialPublicKey.toString('base64'), counter]
    );

    regChallenges.delete(userId);

    return res.json({ verified: true });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* ---------------------------------------------
   RUTA: INICIAR AUTENTICACIÓN (AUTH BEGIN)
----------------------------------------------*/
router.post('/auth-begin', async (req, res) => {
  try {
    const { username } = req.body;

    const u = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (!u.rows.length) return res.status(404).json({ error: 'user not found' });

    const userId = u.rows[0].id;

    const rows = await pool.query('SELECT credential_id FROM credentials WHERE user_id=$1', [userId]);

    const allowCredentials = rows.rows.map(r => ({
      id: Buffer.from(r.credential_id, 'base64url'),
      type: 'public-key'
    }));

    const options = generateAuthenticationOptions({
      timeout: 60000,
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Guardar challenge temporal
    authChallenges.set(userId, options.challenge);

    return res.json({
      options,
      userId,
      displayName: u.rows[0].display_name
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* ---------------------------------------------
   RUTA: COMPLETAR AUTENTICACIÓN (AUTH COMPLETE)
----------------------------------------------*/
router.post('/auth-complete', async (req, res) => {
  try {
    const { userId, assertion, origin } = req.body;

    const cred = await pool.query('SELECT * FROM credentials WHERE user_id=$1 LIMIT 1', [userId]);

    if (!cred.rows.length) {
      return res.status(404).json({ error: 'credential not found' });
    }

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

    if (!verification.verified) {
      return res.status(401).json({ verified: false });
    }

    const newCounter = verification.authenticationInfo.newCounter;

    await pool.query(
      'UPDATE credentials SET sign_count=$1 WHERE id=$2',
      [newCounter, id]
    );

    authChallenges.delete(userId);

    return res.json({ verified: true });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
