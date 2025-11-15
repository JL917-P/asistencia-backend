const { BACKEND, ORIGIN, RP_ID } = window.APP_CONFIG || {};

if (!BACKEND){
  console.error("❌ ERROR: BACKEND no está definido");
}

let attemptCounter = 0;
const MAX_ATTEMPTS = 5;
const $ = s => document.querySelector(s);

/* ----------------------------------------------------------
   NORMALIZACIÓN
---------------------------------------------------------- */
const normalizeUsername = u =>
  (u || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

/* ----------------------------------------------------------
   BASE64URL ⇄ ARRAYBUFFER
---------------------------------------------------------- */
function bufToBase64Url(buffer){
  if (!buffer) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlToBuf(base64url){
  if (!base64url || typeof base64url !== "string")
    return new ArrayBuffer(0);

  const pad = base64url.length % 4 === 0 ? '' :
              '='.repeat(4 - (base64url.length % 4));

  const base64 = base64url.replace(/-/g,'+').replace(/_/g,'/') + pad;
  const str = atob(base64);

  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);

  return bytes.buffer;
}

/* ----------------------------------------------------------
   MINI MAP
---------------------------------------------------------- */
function showMiniMap(lat, lon){
  const url = `https://www.google.com/maps?q=${lat},${lon}&z=18&output=embed`;
  $('#map').innerHTML = `
    <iframe width="100%" height="300" style="border:0" loading="lazy"
      allowfullscreen src="${url}">
    </iframe>`;
}

/* ----------------------------------------------------------
   REGISTRO
---------------------------------------------------------- */
$('#btn-register').onclick = async () => {

  let username = normalizeUsername($('#reg-username').value);
  const display = $('#reg-display').value.trim() || username;

  if (!username){
    alert("⚠️ Ingrese usuario");
    return;
  }

  const res = await fetch(`${BACKEND}/register-begin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName: display })
  });

  const data = await res.json();

  if (!data || !data.options){
    alert("❌ Error: backend no devolvió opciones.");
    console.error("Respuesta backend:", data);
    return;
  }

  if (!data.options.challenge){
    alert("❌ Error: challenge vacío (backend).");
    console.error("Opciones backend:", data.options);
    return;
  }

  const options = data.options;

  /* ---- Convertir a ArrayBuffer ---- */
  options.challenge = base64UrlToBuf(options.challenge);
  options.user.id = base64UrlToBuf(options.user.id);

  if (Array.isArray(options.excludeCredentials)){
    options.excludeCredentials = options.excludeCredentials.map(c => ({
      ...c,
      id: base64UrlToBuf(c.id)
    }));
  }

  try {
    const credential = await navigator.credentials.create({ publicKey: options });

    const attestation = {
      id: credential.id,
      rawId: bufToBase64Url(credential.rawId),
      response: {
        clientDataJSON: bufToBase64Url(credential.response.clientDataJSON),
        attestationObject: bufToBase64Url(credential.response.attestationObject)
      },
      type: credential.type
    };

    const complete = await fetch(`${BACKEND}/register-complete`,{
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: data.userId,
        attestation,
        origin: ORIGIN,
        rpId: RP_ID
      })
    });

    const r2 = await complete.json();
    $('#reg-status').innerText = r2.verified ? "Registro OK" : "Registro falló";
  }
  catch(e){
    console.error(e);
    $('#reg-status').innerText = "❌ Error: " + e.message;
  }
};

/* ----------------------------------------------------------
   AUTENTICACIÓN
---------------------------------------------------------- */
$('#btn-auth').onclick = async () => {
  let username = normalizeUsername($('#auth-username').value);
  if (!username){
    alert("⚠️ Ingrese usuario");
    return;
  }

  attemptCounter = 0;
  await doAuth(username);
};

async function doAuth(username){
  attemptCounter++;
  $('#auth-status').innerText = `Intento ${attemptCounter}/${MAX_ATTEMPTS}`;

  if (attemptCounter > MAX_ATTEMPTS){
    $('#auth-status').innerText = "❌ Máximo de intentos alcanzado.";
    return;
  }

  const beg = await fetch(`${BACKEND}/auth-begin`,{
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });

  const { options, userId, displayName } = await beg.json();

  if (!options || !options.challenge){
    $('#auth-status').innerText = "❌ Error: challenge faltante (backend).";
    console.error("Respuesta backend:", options);
    return;
  }

  options.challenge = base64UrlToBuf(options.challenge);

  if (Array.isArray(options.allowCredentials)){
    options.allowCredentials = options.allowCredentials.map(c => ({
      ...c,
      id: base64UrlToBuf(c.id)
    }));
  }

  try{
    const assertion = await navigator.credentials.get({ publicKey: options });

    const authData = {
      id: assertion.id,
      rawId: bufToBase64Url(assertion.rawId),
      response: {
        clientDataJSON: bufToBase64Url(assertion.response.clientDataJSON),
        authenticatorData: bufToBase64Url(assertion.response.authenticatorData),
        signature: bufToBase64Url(assertion.response.signature),
        userHandle: assertion.response.userHandle ?
                      bufToBase64Url(assertion.response.userHandle) : null
      },
      type: assertion.type
    };

    const r = await fetch(`${BACKEND}/auth-complete`,{
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        assertion: authData,
        origin: ORIGIN,
        rpId: RP_ID
      })
    });

    const result = await r.json();

    if (!result.verified){
      $('#auth-status').innerText = "❌ No reconocido, intente de nuevo.";
      return;
    }

    /* ---------------------------- MARCACIÓN ---------------------------- */
    navigator.geolocation.getCurrentPosition(async pos => {
      
      const { latitude, longitude, accuracy } = pos.coords;

      const markRes = await fetch(`${BACKEND}/mark`,{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          displayName,
          latitude,
          longitude,
          accuracy
        })
      });

      const j = await markRes.json();
      $('#auth-status').innerText =
        `Marcación OK: ${new Date(j.timestamp).toLocaleString()} (${displayName})`;

      showMiniMap(latitude, longitude);

    }, async () => {

      const markRes = await fetch(`${BACKEND}/mark`,{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, displayName })
      });

      const j = await markRes.json();
      $('#auth-status').innerText =
        `Marcación sin ubicación: ${new Date(j.timestamp).toLocaleString()} (${displayName})`;
    });

  }
  catch(e){
    $('#auth-status').innerText =
      `❌ Error: ${e.message} — Intentos ${attemptCounter}/${MAX_ATTEMPTS}`;
  }
}
