const BACKEND = window.APP_CONFIG.BACKEND;
const $ = s => document.querySelector(s);
const tbody = $("#tbl tbody");

// Normalización igual que el backend
const cleanUser = u =>
  (u || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,'');

// Cargar datos
async function fetchMarks() {
  const user = cleanUser($("#f-user").value);
  const start = $("#f-start").value;
  const end = $("#f-end").value;

  const url = new URL(`${BACKEND}/marks-list`);
  if (user) url.searchParams.append("user", user);
  if (start) url.searchParams.append("start", start);
  if (end) url.searchParams.append("end", end);

  const res = await fetch(url);
  return await res.json();
}

// Renderizar tabla
function renderTable(rows) {
  tbody.innerHTML = "";

  rows.forEach(r => {
    const date = new Date(r.timestamp);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.username}</td>
      <td>${r.display_name}</td>
      <td>${date.toLocaleDateString()}</td>
      <td>${date.toLocaleTimeString()}</td>
      <td>${r.latitude && r.longitude ? `${r.latitude}, ${r.longitude}` : "—"}</td>
      <td>
        ${r.latitude && r.longitude
          ? `<button class="map-btn" onclick="openMap(${r.latitude},${r.longitude})">Ver mapa</button>`
          : "—"
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Abrir mapa en ventana
function openMap(lat, lon) {
  const url = `https://www.google.com/maps?q=${lat},${lon}&z=18`;
  window.open(url, "_blank");
}

// Evento filtrar
$("#btn-filter").onclick = async () => {
  const rows = await fetchMarks();
  renderTable(rows);
};

// Exportar
$("#btn-export").onclick = async () => {
  const rows = await fetchMarks();

  let csv = "Usuario,Nombre,Fecha,Hora,Latitud,Longitud\n";

  rows.forEach(r => {
    const d = new Date(r.timestamp);
    const fecha = d.toLocaleDateString();
    const hora = d.toLocaleTimeString();
    csv += `${r.username},${r.display_name},${fecha},${hora},${r.latitude || ""},${r.longitude || ""}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "asistencias.csv";
  a.click();
};

// Cargar inicial
(async () => {
  const rows = await fetchMarks();
  renderTable(rows);
})();
