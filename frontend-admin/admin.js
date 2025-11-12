const { BACKEND } = window.APP_CONFIG;
const $ = s => document.querySelector(s);
let currentRows = [];

$('#btn-load').onclick = loadData;
$('#btn-export').onclick = exportCSV;

async function loadData(){
  const rows = await fetch(`${BACKEND}/marks`).then(r=>r.json());
  currentRows = rows;
  renderTable(rows);
  renderMap(rows);
}

function renderTable(rows){
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${new Date(r.timestamp).toLocaleString()}</td>
      <td>${r.display_name || r.user_id}</td>
      <td>${r.latitude ?? '-'}</td>
      <td>${r.longitude ?? '-'}</td>
      <td>${r.ip ?? '-'}</td>
      <td>${r.user_agent ?? '-'}</td>
    </tr>
  `).join('');
}

function renderMap(rows){
  // Embed simple: centra en el último registro con coordenadas; si no hay, muestra Lima por defecto
  const last = rows.find(r => r.latitude && r.longitude);
  const lat = last ? Number(last.latitude) : -12.0464;
  const lon = last ? Number(last.longitude) : -77.0428;
  const url = `https://www.google.com/maps?q=${lat},${lon}&z=13&output=embed`;
  document.getElementById('map-wrap').innerHTML = `<iframe width="100%" height="500" style="border:0" loading="lazy" allowfullscreen src="${url}"></iframe>`;
}

function exportCSV(){
  const rows = [...document.querySelectorAll('#tbl tbody tr')].map(tr =>
    [...tr.children].map(td => '"' + String(td.textContent).replaceAll('"','""') + '"').join(',')
  );
  const header = '"Fecha/Hora","Empleado","Lat","Lon","IP","UserAgent"';
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `marcaciones_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// carga inicial
loadData();
