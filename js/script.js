// === CONFIGURACIÓN ===
const CONFIG = {
    SHEETS_API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbygDIzPCUrIb86Lnww9Q1-U27lrr0oxKDxPmJLJHWuvzmgcJb0eve0fe_FDTSLqNijsMg/exec' 
};



// === HORARIOS POR TURNO ===
const HORARIOS = {
    "MAÑANA":   { inicio: "06:30", fin: "14:00", icono: "☀️" },
    "TARDE":    { inicio: "14:00", fin: "22:00", icono: "⛅" },
    "NOCHE A":  { inicio: "21:30", fin: "06:30", icono: "🌌" },
    "NOCHE B":  { inicio: "21:30", fin: "06:30", icono: "🌌" },
    "SADOFE":   { inicio: "06:30", fin: "21:30", icono: "🏥" }
};

// === VARIABLES GLOBALES ===
let listaEnfermerosDB = [];
let listaSupervisoresDB = [];
let turnoSeleccionado = "";
let supervisoresActuales = [];
let asignaciones = {}; 
let tercerasAsignadas = [];
let diasCronograma = ""; 
let horarioActual = null; 
let fechasTemporales = [];
let turnoEnProceso = "";

// Variables temporales para el modal de asignación
let pisoActual = "";
let nombreActual = "";
let esExtraActual = false;
let franjaActual = "";

const PISOS = ["1B", "2B", "4B", "1C", "2C", "3C", "4C"];

document.addEventListener('DOMContentLoaded', function() {
    const splash = document.getElementById('splashScreen');
    const modalBox = document.querySelector('.modal-box');
    const shiftModal = document.getElementById('shiftModal');
    
    if (splash) {
        splash.style.display = 'flex';
        splash.style.opacity = '1';
    }
    
    if (shiftModal) {
        shiftModal.style.display = 'none';
    }
    
    if (modalBox) {
        modalBox.innerHTML = `
            <h2 id="modalStatusTitle">🔄 Cargando Base de Datos...</h2>
            <p style="color: #7f8c8d; margin-top: 10px;">Conectando con Google Sheets...</p>
            <div class="spinner" style="border-top-color: #1a5276; margin-top: 20px;"></div>
        `;
    }
    
    fetchDatosDesdeSheets();
    
    setTimeout(() => {
        if (splash) {
            splash.style.transition = 'opacity 0.5s ease';
            splash.style.opacity = '0';
            
            setTimeout(() => {
                splash.style.display = 'none';
                if (shiftModal) {
                    shiftModal.style.display = 'flex';
                }
            }, 500);
        }
    }, 5000);
});

async function fetchDatosDesdeSheets() {
    try {
        const response = await fetch(CONFIG.SHEETS_API_ENDPOINT);
        const data = await response.json();
        
        if (data.enfermeros) listaEnfermerosDB = data.enfermeros;
        if (data.supervisores) listaSupervisoresDB = data.supervisores;
        
        restaurarBotonesModal();
    } catch (error) {
        console.error("❌ ERROR:", error);
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

// === FUNCIONES AUXILIARES ===
function obtenerTurnoEnfermero(enfermero) {
    return (enfermero.turno || enfermero.Turno || enfermero.TURNO || enfermero.turno_enfermero || enfermero.shift || "").toString().toUpperCase().trim();
}

function obtenerNombreEnfermero(enfermero) {
    return (enfermero.nombre || enfermero.Nombre || enfermero.NOMBRE || enfermero.name || "Sin nombre").toString().trim();
}

function turnoCoincide(turnoEnfermero, turnoSeleccionado) {
    if (!turnoEnfermero || !turnoSeleccionado) return false;
    
    const t1 = turnoEnfermero.toString().toUpperCase().trim();
    const t2 = turnoSeleccionado.toString().toUpperCase().trim();
    
    if (t1 === t2) return true;
    
    const t1Normal = t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const t2Normal = t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t1Normal === t2Normal) return true;
    
    if (t1.includes(t2) || t2.includes(t1)) return true;
    if (t1Normal.includes(t2Normal) || t2Normal.includes(t1Normal)) return true;
    
    return false;
}

function fechaCapitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// === SELECCIÓN DE TURNO Y FECHA DIRECTA ===
async function selectTurno(turno) {
    turnoSeleccionado = turno.toUpperCase().trim();
    horarioActual = HORARIOS[turnoSeleccionado];
    turnoEnProceso = turnoSeleccionado;
    fechasTemporales = [];
    
    const descripcionFecha = document.getElementById('descripcionFecha');
    const btnConfirmarFechas = document.getElementById('btnConfirmarFechas');
    
    if (turnoSeleccionado === "SADOFE") {
        descripcionFecha.innerHTML = `
            🏥 <strong>Turno SADOFE</strong><br>
            <small style="color: #6B7280;">
                Selecciona los días de guardia.<br>
                Usa el botón "CONFIRMAR" al terminar.
            </small>
        `;
        if (btnConfirmarFechas) btnConfirmarFechas.style.display = 'block';
    } else {
        descripcionFecha.innerHTML = `
            ${horarioActual.icono} <strong>Turno ${turnoSeleccionado}</strong><br>
            <small style="color: #6B7280;">Selecciona la fecha (Iniciará automáticamente)</small>
        `;
        if (btnConfirmarFechas) btnConfirmarFechas.style.display = 'none';
    }
    
    document.getElementById('fechasSeleccionadas').innerHTML = '<p class="fecha-vacia">No hay fechas seleccionadas</p>';
    document.getElementById('inputFecha').value = '';
    
    document.getElementById('shiftModal').style.display = 'none';
    document.getElementById('modalFecha').style.display = 'flex';
}

function agregarFecha() {
    const inputFecha = document.getElementById('inputFecha');
    const fechaStr = inputFecha.value;
    
    if (!fechaStr) return;
    
    if (fechasTemporales.includes(fechaStr)) {
        alert("⚠️ Esa fecha ya está agregada.");
        inputFecha.value = '';
        return;
    }
    
    fechasTemporales.push(fechaStr);
    renderizarFechasSeleccionadas();
    inputFecha.value = '';

    if (turnoSeleccionado !== "SADOFE") {
        confirmarFechas();
    }
}

function renderizarFechasSeleccionadas() {
    const container = document.getElementById('fechasSeleccionadas');
    container.innerHTML = '';
    
    if (fechasTemporales.length === 0) {
        container.innerHTML = '<p class="fecha-vacia">No hay fechas seleccionadas</p>';
        return;
    }
    
    fechasTemporales.forEach((fechaStr, idx) => {
        const fecha = new Date(fechaStr + 'T00:00:00');
        const opciones = { weekday: 'short', day: 'numeric', month: 'short' };
        const fechaCorta = fecha.toLocaleDateString('es-AR', opciones);
        const fechaCapitalizada = fechaCapitalizar(fechaCorta);
        
        const tag = document.createElement('div');
        tag.className = 'fecha-tag';
        tag.innerHTML = `
            <span>📅 ${fechaCapitalizada}</span>
            <button class="btn-remove-fecha" onclick="eliminarFecha(${idx})">✕</button>
        `;
        container.appendChild(tag);
    });
}

function eliminarFecha(idx) {
    fechasTemporales.splice(idx, 1);
    renderizarFechasSeleccionadas();
}

function confirmarFechas() {
    if (fechasTemporales.length === 0) {
        alert("⚠️ Debes seleccionar al menos una fecha.");
        return;
    }
    
    fechasTemporales.sort();
    
    const fechasFormateadas = fechasTemporales.map(fechaStr => {
        const fecha = new Date(fechaStr + 'T00:00:00');
        const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
        return fechaCapitalizar(fecha.toLocaleDateString('es-AR', opciones));
    });
    
    diasCronograma = fechasFormateadas.length === 1 ? fechasFormateadas[0] : fechasFormateadas.join(' | ');
    
    document.getElementById('modalFecha').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    document.getElementById('turnoDisplay').textContent = turnoSeleccionado;
    document.getElementById('turnoPrint').textContent = turnoSeleccionado;
    document.getElementById('horarioDisplay').textContent = `${horarioActual.inicio} a ${horarioActual.fin}`;
    document.getElementById('diasDisplay').textContent = diasCronograma;
    
    supervisoresActuales = listaSupervisoresDB.filter(s => {
        const turnoSup = (s.turno_supervision || s.Turno_Supervision || "").toString();
        return turnoCoincide(turnoSup, turnoSeleccionado);
    });
    
    if (supervisoresActuales.length > 0) {
        const nombres = supervisoresActuales.map(s => s.nombre || s.Nombre || "Sin nombre").join(", ");
        document.getElementById('supervisorDisplay').textContent = nombres;
    } else {
        document.getElementById('supervisorDisplay').textContent = "Sin supervisor designado";
    }
    
    if (turnoSeleccionado === "SADOFE") {
        document.getElementById('selectTerceraTurnoSub').style.display = 'inline-block';
    }
    
    armarTablaPisos();
    poblarSelectoresTerceras();
}

function cancelarFechas() {
    document.getElementById('modalFecha').style.display = 'none';
    document.getElementById('shiftModal').style.display = 'flex';
    fechasTemporales = [];
    turnoEnProceso = "";
}

// === LÓGICA DE EXCLUSIÓN Y BLOQUEO DE ENFERMEROS YA ASIGNADOS ===
function filtrarEnfermerosAsignados() {
    const ocupados = new Set();

    // 1. Recolectar nombres que ya están en los pisos
    for (const piso in asignaciones) {
        asignaciones[piso].forEach(asig => {
            const nombre = asig.nombreOriginal || asig.texto.split(' (')[0].trim();
            if (nombre) ocupados.add(nombre);
        });
    }

    // 2. Recolectar nombres que están como Terceras
    tercerasAsignadas.forEach(t => {
        const txt = typeof t === 'object' ? t.texto : t;
        let nombre = "";
        if (typeof t === 'object' && t.nombreOriginal) {
            nombre = t.nombreOriginal;
        } else {
            nombre = txt.replace('📌 ', '').replace('Tercera: ', '').split('->')[0].trim();
        }
        if (nombre) ocupados.add(nombre);
    });

    // 3. Bloquear opciones en los selectores de los pisos (Titular y Extra)
    document.querySelectorAll('.cell-selectors select').forEach(select => {
        Array.from(select.options).forEach(opt => {
            if (opt.value === "") return; // Ignorar la opción de "+ Titular" o "+ Extra"
            if (ocupados.has(opt.value)) {
                opt.disabled = true;
                opt.style.display = 'none';
                if (select.value === opt.value) select.value = ""; // Resetea si estaba seleccionado por error
            } else {
                opt.disabled = false;
                opt.style.display = '';
            }
        });
    });

    // 4. Bloquear opciones en el selector inferior de Terceras
    const selectTercera = document.getElementById('selectTerceraNurse');
    if (selectTercera) {
        Array.from(selectTercera.options).forEach(opt => {
            if (opt.value === "") return;
            if (ocupados.has(opt.value)) {
                opt.disabled = true;
                opt.style.display = 'none';
            } else {
                opt.disabled = false;
                opt.style.display = '';
            }
        });
    }
}

// === ARMAR TABLA DE PISOS ===
function armarTablaPisos() {
    const tableBody = document.getElementById('pisosGridRows');
    tableBody.innerHTML = '';

    const titulares = listaEnfermerosDB.filter(e => turnoCoincide(obtenerTurnoEnfermero(e), turnoSeleccionado));
    const extras = listaEnfermerosDB.filter(e => !turnoCoincide(obtenerTurnoEnfermero(e), turnoSeleccionado));

    PISOS.forEach(piso => {
        asignaciones[piso] = [];

        const row = document.createElement('div');
        row.className = 'grid-row';
        
        const pisoCell = document.createElement('div');
        pisoCell.className = 'grid-td-piso';
        pisoCell.textContent = piso;
        
        const assignmentsCell = document.createElement('div');
        assignmentsCell.className = 'grid-td-assignments';
        
        const tagsContainer = document.createElement('div');
        tagsContainer.id = `cell-list-${piso}`;
        tagsContainer.style.cssText = 'display: contents;';
        
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'cell-selectors no-print';
        
        const selectTitular = document.createElement('select');
        selectTitular.onchange = function() { registrarEnfermero(piso, this, false); };
        
        let htmlTitular = '<option value="">+ Titular</option>';
        if (titulares.length === 0) {
            htmlTitular = '<option value="" disabled>⚠️ Sin titulares</option>';
        } else {
            titulares.forEach(e => {
                htmlTitular += `<option value="${obtenerNombreEnfermero(e)}">${obtenerNombreEnfermero(e)}</option>`;
            });
        }
        selectTitular.innerHTML = htmlTitular;
        
        const selectExtra = document.createElement('select');
        selectExtra.onchange = function() { registrarEnfermero(piso, this, true); };
        
        let htmlExtra = '<option value="">+ Extra</option>';
        if (extras.length === 0) {
            htmlExtra = '<option value="" disabled>⚠️ Sin extras</option>';
        } else {
            extras.forEach(e => {
                htmlExtra += `<option value="${obtenerNombreEnfermero(e)}">${obtenerNombreEnfermero(e)} (${obtenerTurnoEnfermero(e)})</option>`;
            });
        }
        selectExtra.innerHTML = htmlExtra;
        
        selectorsContainer.appendChild(selectTitular);
        selectorsContainer.appendChild(selectExtra);
        assignmentsCell.appendChild(tagsContainer);
        assignmentsCell.appendChild(selectorsContainer);
        row.appendChild(pisoCell);
        row.appendChild(assignmentsCell);
        tableBody.appendChild(row);
    });

    filtrarEnfermerosAsignados(); // Aplica el filtro inicial
}

function registrarEnfermero(piso, selectElement, esExtra) {
    const nombre = selectElement.value;
    if (!nombre) return;

    if (esExtra) {
        pisoActual = piso;
        nombreActual = nombre;
        esExtraActual = esExtra;
        
        document.getElementById('tituloModalAsignacion').textContent = `Asignar a ${nombre}`;
        document.getElementById('descripcionModalAsignacion').textContent = `¿Cómo se asigna al Piso ${piso}?`;
        document.getElementById('modalTipoAsignacion').style.display = 'flex';
        
        selectElement.value = "";
        return;
    }

    asignaciones[piso].push({ texto: nombre, esExtra: false, esCambioGuardia: false, nombreOriginal: nombre });
    renderCeldasPiso(piso);
    selectElement.value = "";
    
    filtrarEnfermerosAsignados(); // Actualiza disponibilidad tras agregar
}

function confirmarTipoAsignacion(tipo) {
    document.getElementById('modalTipoAsignacion').style.display = 'none';
    
    if (tipo === 'C') {
        const leyendaFinal = `${nombreActual} (Cambio de Guardia)`;
        asignaciones[pisoActual].push({ texto: leyendaFinal, esExtra: false, esCambioGuardia: true, nombreOriginal: nombreActual });
        renderCeldasPiso(pisoActual);
        filtrarEnfermerosAsignados();
    } else if (tipo === 'E') {
        if (turnoSeleccionado === "SADOFE") {
            document.getElementById('modalFranjaHoraria').style.display = 'flex';
            return;
        }
        
        const leyendaFinal = `${nombreActual} (Extra)`;
        asignaciones[pisoActual].push({ texto: leyendaFinal, esExtra: true, esCambioGuardia: false, nombreOriginal: nombreActual });
        renderCeldasPiso(pisoActual);
        filtrarEnfermerosAsignados();
    }
    
    pisoActual = ""; nombreActual = ""; esExtraActual = false;
}

function cancelarTipoAsignacion() {
    document.getElementById('modalTipoAsignacion').style.display = 'none';
    pisoActual = ""; nombreActual = ""; esExtraActual = false;
}

function confirmarFranjaHoraria(franja) {
    document.getElementById('modalFranjaHoraria').style.display = 'none';
    
    let leyendaFinal = nombreActual;
    if (franja === 'M') leyendaFinal += " (Extra - Mañana)";
    else if (franja === 'T') leyendaFinal += " (Extra - Tarde)";
    
    asignaciones[pisoActual].push({ texto: leyendaFinal, esExtra: true, esCambioGuardia: false, nombreOriginal: nombreActual });
    renderCeldasPiso(pisoActual);
    filtrarEnfermerosAsignados();
    
    pisoActual = ""; nombreActual = ""; esExtraActual = false;
}

function cancelarFranjaHoraria() {
    document.getElementById('modalFranjaHoraria').style.display = 'none';
    pisoActual = ""; nombreActual = ""; esExtraActual = false;
}

function renderCeldasPiso(piso) {
    const contenedorCelda = document.getElementById(`cell-list-${piso}`);
    contenedorCelda.innerHTML = '';

    asignaciones[piso].forEach((asig, idx) => {
        const tag = document.createElement('div');
        let clases = 'nurse-tag';
        if (asig.esCambioGuardia) clases += ' is-cambio-guardia';
        else if (asig.esExtra) clases += ' is-extra';
        
        tag.className = clases;
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
    filtrarEnfermerosAsignados(); // Libera el nombre para volver a usarlo
}

// === TERCERAS ===
function poblarSelectoresTerceras() {
    const select = document.getElementById('selectTerceraNurse');
    select.innerHTML = '<option value="">-- Seleccionar Enfermero/a --</option>';
    listaEnfermerosDB.forEach(e => {
        const nombre = obtenerNombreEnfermero(e);
        const turno = obtenerTurnoEnfermero(e);
        select.innerHTML += `<option value="${nombre}">${nombre} (${turno})</option>`;
    });
    filtrarEnfermerosAsignados();
}

function mostrarSelectorPisos() {
    const enfermero = document.getElementById('selectTerceraNurse').value;
    if (!enfermero) return alert("⚠️ Primero selecciona un enfermero/a.");
    
    if (turnoSeleccionado === "SADOFE") {
        const subTurno = document.getElementById('selectTerceraTurnoSub').value;
        if (!subTurno) return alert("⚠️ Selecciona la franja horaria (Mañana o Tarde) para SADOFE.");
    }
    
    document.getElementById('pisosMultiSelect').style.display = 'block';
    document.querySelectorAll('#pisosMultiSelect input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function confirmarTercera() {
    const enfermero = document.getElementById('selectTerceraNurse').value;
    const checkboxes = document.querySelectorAll('#pisosMultiSelect input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) return alert("⚠️ Selecciona al menos un piso.");
    
    const pisosSeleccionados = Array.from(checkboxes).map(cb => cb.value);
    let plantillaTercera = `Tercera: ${enfermero} -> Piso ${pisosSeleccionados.join(' y ')}`;
    
    if (turnoSeleccionado === "SADOFE") {
        const subTurno = document.getElementById('selectTerceraTurnoSub').value;
        if (subTurno) plantillaTercera += ` [${subTurno === 'MAÑANA' ? '☀️' : '⛅'} ${subTurno}]`;
    }
    
    tercerasAsignadas.push({ texto: plantillaTercera, pisos: pisosSeleccionados, nombreOriginal: enfermero });
    
    const noTercerasMsg = document.getElementById('noTercerasMsg');
    if (noTercerasMsg) noTercerasMsg.style.display = 'none';
    
    renderizarTercerasList();
    filtrarEnfermerosAsignados(); // Actualiza disponibilidad tras agregar tercera
    
    document.getElementById('selectTerceraNurse').value = "";
    document.getElementById('pisosMultiSelect').style.display = 'none';
}

function cancelarTercera() {
    document.getElementById('pisosMultiSelect').style.display = 'none';
}

function renderizarTercerasList() {
    const box = document.getElementById('tercerasContainer');
    box.querySelectorAll('.nurse-tag').forEach(el => el.remove());

    tercerasAsignadas.forEach((t, idx) => {
        const div = document.createElement('div');
        div.className = 'nurse-tag';
        div.style.borderLeftColor = '#9b59b6';
        
        const textoTercera = typeof t === 'object' ? t.texto : t;
        div.innerHTML = `
            <span>📌 ${textoTercera}</span>
            <button class="btn-remove-nurse no-print" onclick="eliminarTerceraIdx(${idx})">❌</button>
        `;
        box.insertBefore(div, document.getElementById('noTercerasMsg'));
    });
}

function eliminarTerceraIdx(idx) {
    tercerasAsignadas.splice(idx, 1);
    if (tercerasAsignadas.length === 0) document.getElementById('noTercerasMsg').style.display = 'block';
    renderizarTercerasList();
    filtrarEnfermerosAsignados(); // Libera el nombre para volver a usarlo
}

// === EXPORTACIONES ===
function generarImagen() {
    const areaCaptura = document.getElementById('cronogramaContainer');
    const clon = areaCaptura.cloneNode(true);
    
    clon.querySelectorAll('.cell-selectors').forEach(el => el.remove());
    clon.querySelectorAll('.terceras-controls').forEach(el => el.remove());
    clon.querySelectorAll('.btn-remove-nurse').forEach(el => el.remove());
    
    const noTercerasMsg = clon.querySelector('#noTercerasMsg');
    if (noTercerasMsg) noTercerasMsg.remove();
    
    clon.querySelectorAll('.grid-row').forEach(row => {
        if (row.querySelectorAll('.nurse-tag').length === 0) row.remove();
    });
    
    const tercerasBlock = clon.querySelector('.terceras-grid-block');
    if (tercerasBlock && tercerasBlock.querySelectorAll('.nurse-tag').length === 0) tercerasBlock.remove();
    
    clon.id = 'clon-temporal-imagen';
    clon.style.cssText = `
        position: absolute; left: -9999px; top: 0; width: 600px;
        padding: 15px; margin: 0; background: #ffffff; z-index: -1; box-sizing: border-box;
    `;
    
    document.body.appendChild(clon);
    
    html2canvas(clon, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: 600
    }).then(canvas => {
        clon.remove();
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0, hasContent = false;
        
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                if (alpha > 0 || data[(y * canvas.width + x) * 4] < 250 || data[(y * canvas.width + x) * 4 + 1] < 250 || data[(y * canvas.width + x) * 4 + 2] < 250) {
                    hasContent = true;
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        
        let canvasFinal = canvas;
        if (hasContent) {
            const width = maxX - minX + 1, height = maxY - minY + 1;
            const canvasRecortado = document.createElement('canvas');
            canvasRecortado.width = width; canvasRecortado.height = height;
            canvasRecortado.getContext('2d').drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
            canvasFinal = canvasRecortado;
        }
        
        const lienzoDestino = document.getElementById('canvasImagen');
        lienzoDestino.width = canvasFinal.width; lienzoDestino.height = canvasFinal.height;
        lienzoDestino.getContext('2d').drawImage(canvasFinal, 0, 0);
        
        const imgContainer = document.getElementById('imagenGeneradaContainer');
        imgContainer.style.display = 'block';
        imgContainer.scrollIntoView({ behavior: 'smooth' });
    }).catch(error => {
        clon.remove();
        alert(`Error al generar imagen: ${error.message}`);
    });
}

function descargarImagen() {
    const canvas = document.getElementById('canvasImagen');
    if (!canvas) return alert("Primero debe generar la imagen.");
    
    const link = document.createElement('a');
    const fecha = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
    link.download = `Programa_Enfermeria_${turnoSeleccionado}_${fecha}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
}

function compartirImagenWhatsApp() {
    const canvas = document.getElementById('canvasImagen');
    if (!canvas) return alert("Primero debe generar la imagen.");

    const nombresSupervisores = supervisoresActuales.length > 0 ? supervisoresActuales.map(s => s.nombre || s.Nombre).join(", ") : "Sin supervisor";
    const textoCompartir = `📋 Programa Enfermería - ${turnoSeleccionado}\n🕐 ${horarioActual.inicio} a ${horarioActual.fin}\n📅 ${diasCronograma}\n⭐ Supervisor/a: ${nombresSupervisores}`;

    canvas.toBlob(async (blob) => {
        if (!blob) return alert("Error al procesar la imagen.");
        const archivoImagen = new File([blob], `Programa_${turnoSeleccionado}.jpg`, { type: 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [archivoImagen] })) {
            try {
                await navigator.share({ files: [archivoImagen], title: `Programa ${turnoSeleccionado}`, text: textoCompartir });
            } catch (err) { console.log("Compartido cancelado:", err); }
        } else {
            alert("Tu navegador no admite compartir archivos directamente.\n\nUsa 'Descargar Imagen' y adjúntala en WhatsApp.");
        }
    }, 'image/jpeg', 0.95);
}

function compartirWhatsAppTexto() {
    const nombresSupervisores = supervisoresActuales.length > 0 ? supervisoresActuales.map(s => s.nombre || s.Nombre).join(", ") : "Sin supervisor";
    
    let txt = `📋 *DISTRIBUCIÓN DE ENFERMERÍA*\n🔄 *Turno:* ${turnoSeleccionado} ${horarioActual.icono}\n🕐 *Horario:* ${horarioActual.inicio} a ${horarioActual.fin}\n📅 *Fecha/s:* ${diasCronograma}\n⭐ *Supervisor/a:* ${nombresSupervisores}\n\n`;

    PISOS.forEach(piso => {
        if (asignaciones[piso] && asignaciones[piso].length > 0) {
            txt += `*🏢 PISO ${piso}:*\n`;
            asignaciones[piso].forEach(asig => {
                let icono = asig.esCambioGuardia ? '🔄' : (asig.esExtra ? '➕' : '•');
                txt += `  ${icono} ${asig.texto}\n`;
            });
            txt += `\n`;
        }
    });

    if (tercerasAsignadas.length > 0) {
        txt += `*📌 TERCERAS / ADICIONALES:*\n`;
        tercerasAsignadas.forEach(t => {
            const txtTercera = typeof t === 'object' ? t.texto : t;
            txt += `  📍 ${txtTercera}\n`;
        });
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
}

function cambiarTurno() {
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('imagenGeneradaContainer').style.display = 'none';
    
    turnoSeleccionado = ""; supervisoresActuales = []; asignaciones = {}; tercerasAsignadas = [];
    diasCronograma = ""; horarioActual = null; fechasTemporales = []; turnoEnProceso = "";
    
    document.getElementById('horarioDisplay').textContent = "";
    document.getElementById('diasDisplay').textContent = "";
    document.getElementById('turnoDisplay').textContent = "";
    document.getElementById('turnoPrint').textContent = "";
    document.getElementById('supervisorDisplay').textContent = "Buscando...";
    document.getElementById('pisosGridRows').innerHTML = '';
    
    const selectTerceraNurse = document.getElementById('selectTerceraNurse');
    const selectTerceraPiso = document.getElementById('selectTerceraPiso');
    if (selectTerceraNurse) selectTerceraNurse.value = "";
    if (selectTerceraPiso) selectTerceraPiso.value = "";
    
    const noTercerasMsg = document.getElementById('noTercerasMsg');
    if (noTercerasMsg) noTercerasMsg.style.display = 'block';
    
    document.querySelectorAll('#tercerasContainer .nurse-tag').forEach(el => el.remove());
    
    document.getElementById('shiftModal').style.display = 'flex';
    restaurarBotonesModal();
}