// === CONFIGURACIÓN DE ENLACE CON TU GOOGLE SHEETS EN VIVO ===
const CONFIG = {
    SHEETS_API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbygDIzPCUrIb86Lnww9Q1-U27lrr0oxKDxPmJLJHWuvzmgcJb0eve0fe_FDTSLqNijsMg/exec' 
};

let listaEnfermerosDB = [];
let listaSupervisoresDB = [];

const PISOS = ["1B", "2B", "4B", "1C", "2C", "3C", "4C"];
let turnoSeleccionado = "";
let supervisorActual = "No Asignado/a";
let asignaciones = {}; 
let tercerasAsignadas = [];

// === FLUJO DE INICIALIZACIÓN Y CARGA DE DATOS ===
document.addEventListener('DOMContentLoaded', function() {
    const modalBox = document.querySelector('.modal-box');
    if (modalBox) {
        modalBox.innerHTML = `
            <h2 id="modalStatusTitle">🔄 Cargando Base de Datos...</h2>
            <p style="color: #7f8c8d; margin-top: 10px;">Espere un momento mientras nos conectamos con Google Sheets.</p>
            <div class="spinner" style="border-top-color: #1a5276; margin-top: 20px;"></div>
        `;
    }

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        splash.style.transition = 'opacity 0.5s ease';
        splash.style.opacity = '0';
        
        setTimeout(() => {
            splash.style.display = 'none';
            document.getElementById('shiftModal').style.display = 'flex';
        }, 500);
    }, 5000); 

    fetchDatosDesdeSheets();
});

async function fetchDatosDesdeSheets() {
    try {
        const response = await fetch(CONFIG.SHEETS_API_ENDPOINT);
        if (response.ok) {
            const data = await response.json();
            
            if (data.enfermeros) listaEnfermerosDB = data.enfermeros;
            if (data.supervisores) listaSupervisoresDB = data.supervisores;
            
            console.log("Información sincronizada con Google Sheets con éxito.");
            restaurarBotonesModal();
        } else {
            marcarErrorCarga();
        }
    } catch (error) {
        console.error(error);
        marcarErrorCarga();
    }
}

function restaurarBotonesModal() {
    const modalBox = document.querySelector('.modal-box');
    if (modalBox) {
        modalBox.innerHTML = `
            <h2>Seleccione el Turno a Armar</h2>
            <div class="shift-options">
                <button onclick="selectTurno('MAÑANA')">☀️ MAÑANA</button>
                <button onclick="selectTurno('TARDE')">⛅ TARDE</button>
                <button onclick="selectTurno('NOCHE A')">🌌 NOCHE A</button>
                <button onclick="selectTurno('NOCHE B')">🌌 NOCHE B</button>
                <button onclick="selectTurno('SADOFE')">🏥 SADOFE</button>
            </div>
        `;
    }
}

function marcarErrorCarga() {
    const title = document.getElementById('modalStatusTitle');
    if (title) {
        title.innerHTML = `⚠️ Error al Cargar Datos`;
        title.style.color = "#e74c3c";
    }
}

// === CONTROLADORES DE TURNO Y FILTRADO REAL ===
function selectTurno(turno) {
    turnoSeleccionado = turno.toUpperCase().trim();
    document.getElementById('shiftModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    document.getElementById('turnoDisplay').textContent = turnoSeleccionado;
    document.getElementById('turnoPrint').textContent = turnoSeleccionado;

    const supervisorEncontrado = listaSupervisoresDB.find(s => s.turno_supervision.toUpperCase().trim() === turnoSeleccionado);
    supervisorActual = supervisorEncontrado ? supervisorEncontrado.nombre : "Sin supervisor designado";
    document.getElementById('supervisorDisplay').textContent = supervisorActual;

    if (turnoSeleccionado === "SADOFE") {
        document.getElementById('selectTerceraTurnoSub').style.display = 'inline-block';
    }

    armarTablaPisos();
    poblarSelectoresTerceras();
}

function armarTablaPisos() {
    const tableBody = document.getElementById('pisosGridRows');
    tableBody.innerHTML = '';

    const titulares = listaEnfermerosDB.filter(e => e.turno.toUpperCase().trim() === turnoSeleccionado);
    const extras = listaEnfermerosDB.filter(e => e.turno.toUpperCase().trim() !== turnoSeleccionado);

    PISOS.forEach(piso => {
        asignaciones[piso] = [];

        const row = document.createElement('div');
        row.className = 'grid-row';
        row.innerHTML = `
            <div class="grid-td-piso">${piso}</div>
            <div class="grid-td-assignments">
                <div id="cell-list-${piso}" style="display:contents;"></div>
                
                <div class="cell-selectors no-print">
                    <select onchange="registrarEnfermero('${piso}', this, false)">
                        <option value="">+ Titular</option>
                        ${titulares.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('')}
                    </select>
                    <select onchange="registrarEnfermero('${piso}', this, true)">
                        <option value="">+ Extra</option>
                        ${extras.map(e => `<option value="${e.nombre}">${e.nombre} (${e.turno})</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
        tableBody.appendChild(row);
    });
}

function registrarEnfermero(piso, selectElement, esExtra) {
    const nombre = selectElement.value;
    if (!nombre) return;

    let leyendaFinal = nombre;

    if (turnoSeleccionado === "SADOFE" && esExtra) {
        const franja = prompt(`El enfermero extra "${nombre}" ¿Estará en la MAÑANA o en la TARDE?\n\nEscriba 'M' o 'T':`).trim().toUpperCase();
        if (franja === 'M') {
            leyendaFinal += " (Extra - Mañana)";
        } else if (franja === 'T') {
            leyendaFinal += " (Extra - Tarde)";
        } else {
            alert("Operación cancelada.");
            selectElement.value = "";
            return;
        }
    } else if (esExtra) {
        leyendaFinal += " (Extra)";
    }

    asignaciones[piso].push({ texto: leyendaFinal, esExtra: esExtra });
    renderCeldasPiso(piso);
    selectElement.value = "";
}

function renderCeldasPiso(piso) {
    const contenedorCelda = document.getElementById(`cell-list-${piso}`);
    contenedorCelda.innerHTML = '';

    asignaciones[piso].forEach((asig, idx) => {
        const tag = document.createElement('div');
        tag.className = `nurse-tag ${asig.esExtra ? 'is-extra' : ''}`;
        tag.innerHTML = `
            <span>👤 ${asig.texto}</span>
            <button class="btn-remove-nurse no-print" onclick="removerEnfermeroCelda('${piso}', ${idx})">❌</button>
        `;
        contenedorCelda.appendChild(tag);
    });
}

function removerEnfermeroCelda(piso, idx) {
    asignaciones[piso].splice(idx, 1);
    renderCeldasPiso(piso);
}

// === GESTIÓN DE PERSONAL EN TERCERAS ===
function poblarSelectoresTerceras() {
    const select = document.getElementById('selectTerceraNurse');
    select.innerHTML = '<option value="">-- Seleccionar Enfermero/a --</option>';
    listaEnfermerosDB.forEach(e => {
        select.innerHTML += `<option value="${e.nombre}">${e.nombre} (${e.turno})</option>`;
    });
}

function agregarTercera() {
    const enfermero = document.getElementById('selectTerceraNurse').value;
    const pisoDestino = document.getElementById('selectTerceraPiso').value;
    
    if (!enfermero || !pisoDestino) return alert("Complete los campos.");

    let plantillaTercera = `Tercera: ${enfermero} -> Piso ${pisoDestino}`;

    if (turnoSeleccionado === "SADOFE") {
        const subTurnoSadofe = document.getElementById('selectTerceraTurnoSub').value;
        plantillaTercera += ` (${subTurnoSadofe})`;
    }

    tercerasAsignadas.push(plantillaTercera);
    document.getElementById('noTercerasMsg').style.display = 'none';
    renderizarTercerasList();

    document.getElementById('selectTerceraNurse').value = "";
    document.getElementById('selectTerceraPiso').value = "";
}

function renderizarTercerasList() {
    const box = document.getElementById('tercerasContainer');
    box.querySelectorAll('.nurse-tag').forEach(el => el.remove());

    tercerasAsignadas.forEach((t, idx) => {
        const div = document.createElement('div');
        div.className = 'nurse-tag';
        div.style.borderLeftColor = '#9b59b6';
        div.innerHTML = `
            <span>📌 ${t}</span>
            <button class="btn-remove-nurse no-print" onclick="eliminarTerceraIdx(${idx})">❌</button>
        `;
        box.insertBefore(div, document.getElementById('noTercerasMsg'));
    });
}

function eliminarTerceraIdx(idx) {
    tercerasAsignadas.splice(idx, 1);
    if (tercerasAsignadas.length === 0) document.getElementById('noTercerasMsg').style.display = 'block';
    renderizarTercerasList();
}

// === EXPORTACIONES EN FORMATO JPG ===
function generarImagen() {
    const areaCaptura = document.getElementById('cronogramaContainer');
    
    document.querySelectorAll('.cell-selectors').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.terceras-controls').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.btn-remove-nurse').forEach(el => el.style.display = 'none');

    html2canvas(areaCaptura, {
        scale: 2,
        backgroundColor: "#ffffff", // Garantiza fondo blanco para el formato JPG
        useCORS: true
    }).then(canvas => {
        const lienzoDestino = document.getElementById('canvasImagen');
        lienzoDestino.width = canvas.width;
        lienzoDestino.height = canvas.height;
        lienzoDestino.getContext('2d').drawImage(canvas, 0, 0);

        document.getElementById('imagenGeneradaContainer').style.display = 'block';
        document.getElementById('imagenGeneradaContainer').scrollIntoView({ behavior: 'smooth' });

        document.querySelectorAll('.cell-selectors').forEach(el => el.style.display = '');
        document.querySelectorAll('.terceras-controls').forEach(el => el.style.display = '');
        document.querySelectorAll('.btn-remove-nurse').forEach(el => el.style.display = '');
    });
}

function descargarImagen() {
    const link = document.createElement('a');
    link.download = `Planilla_Enfermeria_${turnoSeleccionado}.jpg`;
    // Exportamos forzando calidad JPG
    link.href = document.getElementById('canvasImagen').toDataURL('image/jpeg', 0.95);
    link.click();
}

// Envío de Imagen directa en JPG
function compartirImagenWhatsApp() {
    const canvas = document.getElementById('canvasImagen');
    if (!canvas) return alert("Primero debe generar la imagen.");

    canvas.toBlob(async (blob) => {
        if (!blob) return alert("Error al procesar el archivo de imagen.");
        
        const archivoImagen = new File([blob], `Programa_${turnoSeleccionado}.jpg`, { type: 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [archivoImagen] })) {
            try {
                await navigator.share({
                    files: [archivoImagen],
                    title: `Programa Enfermería - ${turnoSeleccionado}`,
                    text: `Distribución del personal. Supervisor/a: ${supervisorActual}.`
                });
            } catch (err) {
                console.log("Compartido cancelado o error en transferencia:", err);
            }
        } else {
            alert("Tu navegador o dispositivo no admite compartir archivos de imagen directamente.\n\nPor favor, usa el botón azul 'Descargar Imagen' y adjúntala manualmente en tu WhatsApp.");
        }
    }, 'image/jpeg', 0.95);
}

// TEXTO PLANO POR WHATSAPP (Solo la info del programa sin firma)
function compartirWhatsAppTexto() {
    let bloqueTexto = `📋 *DISTRIBUCIÓN DE ENFERMERÍA - TURNO ${turnoSeleccionado}*\n`;
    bloqueTexto += `⭐ *Supervisor/a:* ${supervisorActual}\n`;
    bloqueTexto += `📅 _Fecha: ${new Date().toLocaleDateString('es-AR')}_\n\n`;

    PISOS.forEach(piso => {
        bloqueTexto += `*PISO ${piso}:*\n`;
        if (asignaciones[piso].length === 0) {
            bloqueTexto += `  - Sin personal asignado\n`;
        } else {
            asignaciones[piso].forEach(asig => bloqueTexto += `  • ${asig.texto}\n`);
        }
        bloqueTexto += `\n`;
    });

    if (tercerasAsignadas.length > 0) {
        bloqueTexto += `*📌 TERCERAS / ADICIONALES:*\n`;
        tercerasAsignadas.forEach(t => bloqueTexto += `  • ${t}\n`);
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(bloqueTexto)}`, '_blank');
}