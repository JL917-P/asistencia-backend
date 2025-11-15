const { BACKEND, ORIGIN } = window.APP_CONFIG;
let attemptCounter = 0;
const MAX_ATTEMPTS = 5;
const $ = s => document.querySelector(s);

// Normalización segura de username
const normalizeUsername = u =>
  u.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,'');

function bufToBase64Url(buffer){
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function base64UrlToBuf(base64url){
  const pad = base64url.length%4===0?'':'='.repeat(4-base64url.length%4);
  const base64 = base64url.replace(/-/g,'+').replace(/_/g,'/')+pad;
  const str = atob(base64);
  const bytes = new Uint8Array(str.length);
  for(let i=0;i<str.length;i++) bytes[i]=str.charCodeAt(i);
  return bytes.buffer;
}

function showMiniMap(lat, lon){
  const url = `https://www.google.com/maps?q=${lat},${lon}&z=18&output=embed`;
  $('#map').innerHTML = `<iframe width="100%" height="300" style="border:0" loading="lazy" allowfullscreen src="${url}"></iframe>`;
}

$('#btn-register').onclick = async () => {
  let username = $('#reg-username').value;
  username = normalizeUsername(username);

  const display = $('#reg-display').value.trim() || username;
  if(!username){ alert('Ingrese usuario'); return; }

  const res = await fetch(`${BACKEND}/register-begin`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username, displayName: display })
  });

  const data = await res.json();
  const options = data.options;
  options.challenge = base64UrlToBuf(options.challenge);
  options.user.id = base64UrlToBuf(options.user.id);
  if (options.excludeCredentials) for (let c of options.excludeCredentials) c.id = base64UrlToBuf(c.id);

  try{
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
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId: data.userId, attestation, origin: ORIGIN })
    });

    const r2 = await complete.json();
    $('#reg-status').innerText = r2.verified ? 'Registro OK' : 'Registro falló';
  }catch(e){ alert('Error registro: '+e.message); }
};

$('#btn-auth').onclick = async () => {
  let username = $('#auth-username').value;
  username = normalizeUsername(username);

  if(!username){ alert('Ingrese usuario'); return; }
  attemptCounter = 0;
  await doAuth(username);
};

async function doAuth(username){
  attemptCounter++;
  if(attemptCounter>MAX_ATTEMPTS){
    $('#auth-status').innerText='Máximo de intentos alcanzado.';
    return;
  }

  $('#auth-status').innerText = `Intento ${attemptCounter}/${MAX_ATTEMPTS}`;

  // envío seguro
  const beg = await fetch(`${BACKEND}/auth-begin`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username })
  });

  const { options, userId, displayName } = await beg.json();
  options.challenge = base64UrlToBuf(options.challenge);

  if(options.allowCredentials){
    options.allowCredentials = options.allowCredentials
      .map(c => ({ ...c, id: base64UrlToBuf(c.id) }));
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
        userHandle: assertion.response.userHandle ? bufToBase64Url(assertion.response.userHandle) : null
      },
      type: assertion.type
    };

    const r = await fetch(`${BACKEND}/auth-complete`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId, assertion: authData, origin: ORIGIN })
    });

    const result = await r.json();
    if(!result.verified){
      $('#auth-status').innerText='No reconocido, intente de nuevo.';
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const { latitude, longitude, accuracy } = pos.coords;
      const markRes = await fetch(`${BACKEND}/mark`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId, displayName, latitude, longitude, accuracy })
      });
      const j = await markRes.json();
      $('#auth-status').innerText = `Marcación OK: ${new Date(j.timestamp).toLocaleString()} (${displayName})`;
      showMiniMap(latitude, longitude);
    }, async (_err)=>{
      const markRes = await fetch(`${BACKEND}/mark`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId, displayName })
      });
      const j = await markRes.json();
      $('#auth-status').innerText = `Marcación sin ubicación: ${new Date(j.timestamp).toLocaleString()} (${displayName})`;
    }, { enableHighAccuracy:true, timeout:10000 });

  }catch(e){
    $('#auth-status').innerText = `Error: ${e.message} — Intentos ${attemptCounter}/${MAX_ATTEMPTS}`;
  }
}
