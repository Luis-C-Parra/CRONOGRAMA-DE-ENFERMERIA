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
let diasCronograma = ""; // Para almacenar los días (ej: "Sábado 28 y Domingo 29")
let horarioActual = null; // Para almacenar el horario del turno

const PISOS = ["1B", "2B", "4B", "1C", "2C", "3C", "4C"];


document.addEventListener('DOMContentLoaded', function() {
    const splash = document.getElementById('splashScreen');
    const modalBox = document.querySelector('.modal-box');
    const shiftModal = document.getElementById('shiftModal');
    
    // Asegurar que el splash esté visible al inicio
    if (splash) {
        splash.style.display = 'flex';
        splash.style.opacity = '1';
    }
    
    // Ocultar el modal inicialmente
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
    
    // Cargar datos
    fetchDatosDesdeSheets();
    
    // Después de 5 segundos, ocultar splash y mostrar modal
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
        
        console.log("📊 DATOS RECIBIDOS:", data);
        
        if (data.enfermeros) {
            listaEnfermerosDB = data.enfermeros;
            console.log(`✅ ${listaEnfermerosDB.length} enfermeros cargados`);
        }
        
        if (data.supervisores) {
            listaSupervisoresDB = data.supervisores;
            console.log(`✅ ${listaSupervisoresDB.length} supervisores cargados`);
        }
        
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
    return (enfermero.turno || 
            enfermero.Turno || 
            enfermero.TURNO || 
            enfermero.turno_enfermero ||
            enfermero.shift ||
            "").toString().toUpperCase().trim();
}

function obtenerNombreEnfermero(enfermero) {
    return (enfermero.nombre || 
            enfermero.Nombre || 
            enfermero.NOMBRE || 
            enfermero.name ||
            "Sin nombre").toString().trim();
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



// === SELECCIÓN DE TURNO - SIN SPLASH ===
// Variable para almacenar fechas temporalmente
let fechasTemporales = [];
let turnoEnProceso = "";

async function selectTurno(turno) {
    turnoSeleccionado = turno.toUpperCase().trim();
    horarioActual = HORARIOS[turnoSeleccionado];
    turnoEnProceso = turnoSeleccionado;
    fechasTemporales = [];
    
    // Mostrar modal de fechas
    const descripcionFecha = document.getElementById('descripcionFecha');
    
    if (turnoSeleccionado === "SADOFE") {
        descripcionFecha.innerHTML = `
            🏥 <strong>Turno SADOFE</strong><br>
            <small style="color: #6B7280;">
                Selecciona los días de guardia. Puede ser:<br>
                • Solo un día feriado<br>
                • Sábado y Domingo<br>
                • Varios días consecutivos
            </small>
        `;
    } else {
        descripcionFecha.innerHTML = `
            ${horarioActual.icono} <strong>Turno ${turnoSeleccionado}</strong><br>
            <small style="color: #6B7280;">Selecciona la fecha del cronograma</small>
        `;
    }
    
    // Limpiar lista de fechas
    document.getElementById('fechasSeleccionadas').innerHTML = '<p class="fecha-vacia">No hay fechas seleccionadas</p>';
    document.getElementById('inputFecha').value = '';
    
    // Mostrar modal
    document.getElementById('modalFecha').style.display = 'flex';
}

// === AGREGAR FECHA ===
function agregarFecha() {
    const inputFecha = document.getElementById('inputFecha');
    const fechaStr = inputFecha.value;
    
    if (!fechaStr) {
        alert("⚠️ Selecciona una fecha del calendario.");
        return;
    }
    
    // Convertir fecha a formato legible
    const fecha = new Date(fechaStr + 'T00:00:00');
    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const fechaFormateada = fecha.toLocaleDateString('es-AR', opciones);
    const fechaCapitalizada = fechaCapitalizar(fechaFormateada);
    
    // Verificar si ya existe
    if (fechasTemporales.includes(fechaStr)) {
        alert("⚠️ Esa fecha ya está agregada.");
        return;
    }
    
    // Agregar
    fechasTemporales.push(fechaStr);
    
    // Renderizar lista
    renderizarFechasSeleccionadas();
    
    // Limpiar input
    inputFecha.value = '';
}

// === RENDERIZAR FECHAS SELECCIONADAS ===
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

// === ELIMINAR FECHA ===
function eliminarFecha(idx) {
    fechasTemporales.splice(idx, 1);
    renderizarFechasSeleccionadas();
}

// === CONFIRMAR FECHAS ===
function confirmarFechas() {
    if (fechasTemporales.length === 0) {
        alert("⚠️ Debes seleccionar al menos una fecha.");
        return;
    }
    
    // Ordenar fechas
    fechasTemporales.sort();
    
    // Construir texto de fechas
    const fechasFormateadas = fechasTemporales.map(fechaStr => {
        const fecha = new Date(fechaStr + 'T00:00:00');
        const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
        return fechaCapitalizar(fecha.toLocaleDateString('es-AR', opciones));
    });
    
    if (fechasFormateadas.length === 1) {
        diasCronograma = fechasFormateadas[0];
    } else {
        diasCronograma = fechasFormateadas.join(' | ');
    }
    
    // Cerrar modal de fechas
    document.getElementById('modalFecha').style.display = 'none';
    
    // Mostrar app
    document.getElementById('shiftModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Actualizar displays
    document.getElementById('turnoDisplay').textContent = turnoSeleccionado;
    document.getElementById('turnoPrint').textContent = turnoSeleccionado;
    document.getElementById('horarioDisplay').textContent = `${horarioActual.inicio} a ${horarioActual.fin}`;
    document.getElementById('diasDisplay').textContent = diasCronograma;
    
    // Buscar supervisores
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
    
    // Mostrar selector de sub-turno si es SADOFE
    if (turnoSeleccionado === "SADOFE") {
        document.getElementById('selectTerceraTurnoSub').style.display = 'inline-block';
    }
    
    armarTablaPisos();
    poblarSelectoresTerceras();
}

// === CANCELAR FECHAS ===
function cancelarFechas() {
    document.getElementById('modalFecha').style.display = 'none';
    document.getElementById('shiftModal').style.display = 'flex';
    fechasTemporales = [];
    turnoEnProceso = "";
}

// === FUNCION AUXILIAR: CAPITALIZAR PRIMERA LETRA ===
function fechaCapitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
// === ARMAR TABLA DE PISOS ===
function armarTablaPisos() {
    const tableBody = document.getElementById('pisosGridRows');
    if (!tableBody) {
        console.error("❌ ERROR: No se encontró 'pisosGridRows'");
        return;
    }
    
    tableBody.innerHTML = '';

    const titulares = listaEnfermerosDB.filter(e => {
        const turno = obtenerTurnoEnfermero(e);
        return turnoCoincide(turno, turnoSeleccionado);
    });

    const extras = listaEnfermerosDB.filter(e => {
        const turno = obtenerTurnoEnfermero(e);
        return !turnoCoincide(turno, turnoSeleccionado);
    });

    console.log(`🎯 TURNO: ${turnoSeleccionado}`);
    console.log(`✅ TITULARES: ${titulares.length}`);
    console.log(`✅ EXTRAS: ${extras.length}`);

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
        
        // Contenedor de selectores
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'cell-selectors no-print';
        
        // Select de titulares
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
        
        // Select de extras
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
        
        // Ensamblar
        selectorsContainer.appendChild(selectTitular);
        selectorsContainer.appendChild(selectExtra);
        assignmentsCell.appendChild(tagsContainer);
        assignmentsCell.appendChild(selectorsContainer);
        row.appendChild(pisoCell);
        row.appendChild(assignmentsCell);
        tableBody.appendChild(row);
    });
}

// Variables temporales para el modal
let pisoActual = "";
let nombreActual = "";
let esExtraActual = false;
let franjaActual = "";

function registrarEnfermero(piso, selectElement, esExtra) {
    const nombre = selectElement.value;
    if (!nombre) return;

    if (esExtra) {
        // Guardar datos temporalmente
        pisoActual = piso;
        nombreActual = nombre;
        esExtraActual = esExtra;
        
        // Mostrar modal en vez de prompt
        document.getElementById('tituloModalAsignacion').textContent = `Asignar a ${nombre}`;
        document.getElementById('descripcionModalAsignacion').textContent = `¿Cómo se asigna al Piso ${piso}?`;
        document.getElementById('modalTipoAsignacion').style.display = 'flex';
        
        selectElement.value = "";
        return;
    }

    // Si es titular, agregar directamente
    asignaciones[piso].push({ 
        texto: nombre, 
        esExtra: false,
        esCambioGuardia: false
    });
    
    renderCeldasPiso(piso);
    selectElement.value = "";
}

// === CONFIRMAR TIPO DE ASIGNACIÓN (Extra o Cambio de Guardia) ===
function confirmarTipoAsignacion(tipo) {
    document.getElementById('modalTipoAsignacion').style.display = 'none';
    
    if (tipo === 'C') {
        // Cambio de Guardia - agregar directamente
        const leyendaFinal = `${nombreActual} (Cambio de Guardia)`;
        asignaciones[pisoActual].push({ 
            texto: leyendaFinal, 
            esExtra: false,
            esCambioGuardia: true
        });
        renderCeldasPiso(pisoActual);
    } else if (tipo === 'E') {
        // Extra - si es SADOFE, preguntar franja horaria
        if (turnoSeleccionado === "SADOFE") {
            document.getElementById('modalFranjaHoraria').style.display = 'flex';
            return;
        }
        
        // Si no es SADOFE, agregar como Extra normal
        const leyendaFinal = `${nombreActual} (Extra)`;
        asignaciones[pisoActual].push({ 
            texto: leyendaFinal, 
            esExtra: true,
            esCambioGuardia: false
        });
        renderCeldasPiso(pisoActual);
    }
    
    // Resetear variables
    pisoActual = "";
    nombreActual = "";
    esExtraActual = false;
}

// === CANCELAR TIPO DE ASIGNACIÓN ===
function cancelarTipoAsignacion() {
    document.getElementById('modalTipoAsignacion').style.display = 'none';
    pisoActual = "";
    nombreActual = "";
    esExtraActual = false;
}

// === CONFIRMAR FRANJA HORARIA (SADOFE) ===
function confirmarFranjaHoraria(franja) {
    document.getElementById('modalFranjaHoraria').style.display = 'none';
    
    let leyendaFinal = nombreActual;
    if (franja === 'M') {
        leyendaFinal += " (Extra - Mañana)";
    } else if (franja === 'T') {
        leyendaFinal += " (Extra - Tarde)";
    }
    
    asignaciones[pisoActual].push({ 
        texto: leyendaFinal, 
        esExtra: true,
        esCambioGuardia: false
    });
    renderCeldasPiso(pisoActual);
    
    // Resetear variables
    pisoActual = "";
    nombreActual = "";
    esExtraActual = false;
}

// === CANCELAR FRANJA HORARIA ===
function cancelarFranjaHoraria() {
    document.getElementById('modalFranjaHoraria').style.display = 'none';
    pisoActual = "";
    nombreActual = "";
    esExtraActual = false;
}

function renderCeldasPiso(piso) {
    const contenedorCelda = document.getElementById(`cell-list-${piso}`);
    contenedorCelda.innerHTML = '';

    asignaciones[piso].forEach((asig, idx) => {
        const tag = document.createElement('div');
        
        // Clases CSS según tipo
        let clases = 'nurse-tag';
        if (asig.esCambioGuardia) {
            clases += ' is-cambio-guardia';
        } else if (asig.esExtra) {
            clases += ' is-extra';
        }
        
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
}

// === TERCERAS ===
// === TERCERAS ===
function poblarSelectoresTerceras() {
    const select = document.getElementById('selectTerceraNurse');
    select.innerHTML = '<option value="">-- Seleccionar Enfermero/a --</option>';
    listaEnfermerosDB.forEach(e => {
        const nombre = obtenerNombreEnfermero(e);
        const turno = obtenerTurnoEnfermero(e);
        select.innerHTML += `<option value="${nombre}">${nombre} (${turno})</option>`;
    });
}

// === MOSTRAR SELECTOR DE PISOS (MULTI-SELECCIÓN) ===
function mostrarSelectorPisos() {
    const enfermero = document.getElementById('selectTerceraNurse').value;
    
    if (!enfermero) {
        alert("⚠️ Primero selecciona un enfermero/a.");
        return;
    }
    
    // Si es SADOFE, verificar franja horaria
    if (turnoSeleccionado === "SADOFE") {
        const subTurno = document.getElementById('selectTerceraTurnoSub').value;
        if (!subTurno) {
            alert("⚠️ Selecciona la franja horaria (Mañana o Tarde) para SADOFE.");
            return;
        }
    }
    
    // Mostrar el selector de pisos
    document.getElementById('pisosMultiSelect').style.display = 'block';
    
    // Limpiar checkboxes
    document.querySelectorAll('#pisosMultiSelect input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
}

// === CONFIRMAR TERCERA CON MÚLTIPLES PISOS ===
function confirmarTercera() {
    console.log("🔍 INICIANDO confirmarTercera()");
    
    const enfermero = document.getElementById('selectTerceraNurse').value;
    console.log("👤 Enfermero seleccionado:", enfermero);
    
    const checkboxes = document.querySelectorAll('#pisosMultiSelect input[type="checkbox"]:checked');
    console.log("✅ Checkboxes seleccionados:", checkboxes.length);
    
    if (checkboxes.length === 0) {
        console.warn("⚠️ No hay pisos seleccionados");
        alert("⚠️ Selecciona al menos un piso.");
        return;
    }
    
    // Obtener pisos seleccionados
    const pisosSeleccionados = Array.from(checkboxes).map(cb => {
        console.log("  - Piso:", cb.value);
        return cb.value;
    });
    
    console.log("📋 Pisos:", pisosSeleccionados);
    
    // Construir plantilla
    let plantillaTercera = `Tercera: ${enfermero} -> Piso ${pisosSeleccionados.join(' y ')}`;
    console.log("📝 Plantilla:", plantillaTercera);
    
    // Agregar franja horaria si es SADOFE
    if (turnoSeleccionado === "SADOFE") {
        const subTurno = document.getElementById('selectTerceraTurnoSub').value;
        console.log("🏥 SADOFE - SubTurno:", subTurno);
        if (subTurno) {
            plantillaTercera += ` [${subTurno === 'MAÑANA' ? '☀️' : '⛅'} ${subTurno}]`;
        }
    }
    
    // Agregar a la lista
    console.log("💾 Agregando a tercerasAsignadas...");
    console.log("  - Antes:", tercerasAsignadas.length);
    
    tercerasAsignadas.push({
        texto: plantillaTercera,
        pisos: pisosSeleccionados
    });
    
    console.log("  - Después:", tercerasAsignadas.length);
    console.log("  - Datos:", tercerasAsignadas);
    
    // Ocultar mensaje "no hay terceras"
    const noTercerasMsg = document.getElementById('noTercerasMsg');
    console.log("🔍 noTercerasMsg:", noTercerasMsg);
    if (noTercerasMsg) {
        noTercerasMsg.style.display = 'none';
        console.log("✅ Mensaje ocultado");
    }
    
    // Renderizar lista
    console.log("🎨 Llamando a renderizarTercerasList()...");
    renderizarTercerasList();
    
    // Limpiar y ocultar
    document.getElementById('selectTerceraNurse').value = "";
    document.getElementById('pisosMultiSelect').style.display = 'none';
    console.log("✅ Limpieza completada");
    console.log("🎉 Tercera agregada exitosamente!");
}
// === CANCELAR TERCERA ===
function cancelarTercera() {
    document.getElementById('pisosMultiSelect').style.display = 'none';
}

// === RENDERIZAR LISTA DE TERCERAS ===
function renderizarTercerasList() {
    console.log("🎨 INICIANDO renderizarTercerasList()");
    console.log("  - Terceras asignadas:", tercerasAsignadas.length);
    
    const box = document.getElementById('tercerasContainer');
    console.log("  - Contenedor:", box);
    
    if (!box) {
        console.error("❌ ERROR: No se encontró 'tercerasContainer'");
        return;
    }
    
    // Eliminar tags existentes
    box.querySelectorAll('.nurse-tag').forEach(el => {
        console.log("  - Eliminando tag:", el);
        el.remove();
    });

    // Agregar nuevas terceras
    tercerasAsignadas.forEach((t, idx) => {
        console.log(`  - Agregando tercera ${idx}:`, t);
        
        const div = document.createElement('div');
        div.className = 'nurse-tag';
        div.style.borderLeftColor = '#9b59b6';
        
        // Manejar tanto objetos como strings
        const textoTercera = typeof t === 'object' ? t.texto : t;
        
        div.innerHTML = `
            <span>📌 ${textoTercera}</span>
            <button class="btn-remove-nurse no-print" onclick="eliminarTerceraIdx(${idx})">❌</button>
        `;
        
        const noTercerasMsg = document.getElementById('noTercerasMsg');
        box.insertBefore(div, noTercerasMsg);
        console.log("  - Tag agregado al DOM");
    });
    
    console.log("✅ renderizarTercerasList() completado");
}
// === ELIMINAR TERCERA ===
function eliminarTerceraIdx(idx) {
    tercerasAsignadas.splice(idx, 1);
    if (tercerasAsignadas.length === 0) {
        document.getElementById('noTercerasMsg').style.display = 'block';
    }
    renderizarTercerasList();
}

// === EXPORTACIONES ===
function generarImagen() {
    console.log("🔍 INICIANDO GENERAR IMAGEN...");
    
    const areaCaptura = document.getElementById('cronogramaContainer');
    if (!areaCaptura) {
        alert("ERROR: No se encontró el área de captura.");
        return;
    }
    
    // Crear clon
    const clon = areaCaptura.cloneNode(true);
    
    // === ELIMINAR ELEMENTOS NO DESEADOS ===
    clon.querySelectorAll('.cell-selectors').forEach(el => el.remove());
    clon.querySelectorAll('.terceras-controls').forEach(el => el.remove());
    clon.querySelectorAll('.btn-remove-nurse').forEach(el => el.remove());
    
    const noTercerasMsg = clon.querySelector('#noTercerasMsg');
    if (noTercerasMsg) noTercerasMsg.remove();
    
    // Eliminar filas vacías
    clon.querySelectorAll('.grid-row').forEach(row => {
        const tags = row.querySelectorAll('.nurse-tag');
        if (tags.length === 0) row.remove();
    });
    
    // Eliminar sección Terceras si está vacía
    const tercerasBlock = clon.querySelector('.terceras-grid-block');
    if (tercerasBlock) {
        const tagsTerceras = tercerasBlock.querySelectorAll('.nurse-tag');
        if (tagsTerceras.length === 0) tercerasBlock.remove();
    }
    
    // === AJUSTAR ESTILOS PARA IMAGEN COMPACTA ===
    clon.id = 'clon-temporal-imagen';
    clon.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 600px;
        padding: 15px;
        margin: 0;
        background: #ffffff;
        z-index: -1;
        box-sizing: border-box;
    `;
    
    // Ajustar header
    const gridHeader = clon.querySelector('.grid-table-header');
    if (gridHeader) {
        gridHeader.style.marginBottom = '10px';
        gridHeader.style.paddingBottom = '10px';
    }
    
    // Ajustar meta info (turno, horario, etc.)
    const metaInfo = clon.querySelector('.grid-meta-info');
    if (metaInfo) {
        metaInfo.style.gap = '8px';
        metaInfo.style.padding = '10px';
        metaInfo.style.marginTop = '8px';
    }
    
    // Ajustar filas
    clon.querySelectorAll('.grid-row').forEach(row => {
        row.style.marginBottom = '8px';
    });
    
    // Ajustar celdas de asignaciones
    clon.querySelectorAll('.grid-td-assignments').forEach(cell => {
        cell.style.padding = '8px';
        cell.style.minHeight = 'auto';
    });
    
    // Ajustar tags de enfermeros
    clon.querySelectorAll('.nurse-tag').forEach(tag => {
        tag.style.margin = '4px 0';
        tag.style.padding = '8px 12px';
    });
    
    // Ajustar título de terceras
    const tercerasTitle = clon.querySelector('.terceras-title-bar');
    if (tercerasTitle) {
        tercerasTitle.style.padding = '10px';
        tercerasTitle.style.marginTop = '15px';
    }
    
    // Ajustar contenedor de terceras
    const tercerasContainer = clon.querySelector('.terceras-list-box');
    if (tercerasContainer) {
        tercerasContainer.style.padding = '10px';
        tercerasContainer.style.gap = '6px';
    }
    
    // Ajustar footer
    const printFooter = clon.querySelector('.print-footer');
    if (printFooter) {
        printFooter.style.marginTop = '15px';
        printFooter.style.paddingTop = '10px';
        printFooter.style.fontSize = '0.75rem';
    }
    
    // Agregar clon al DOM temporalmente
    document.body.appendChild(clon);
    
    // === GENERAR IMAGEN ===
    if (typeof html2canvas === 'undefined') {
        clon.remove();
        alert("ERROR: html2canvas no está cargado.");
        return;
    }
    
    html2canvas(clon, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: 600
    }).then(canvas => {
        clon.remove();
        
        // === RECORTAR ESPACIOS BLANCOS ===
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let minX = canvas.width, maxX = 0;
        let minY = canvas.height, maxY = 0;
        let hasContent = false;
        
        // Buscar límites del contenido
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                
                // Si el pixel no es blanco puro (alpha > 0 o color != 255)
                if (alpha > 0 || 
                    data[(y * canvas.width + x) * 4] < 250 || 
                    data[(y * canvas.width + x) * 4 + 1] < 250 || 
                    data[(y * canvas.width + x) * 4 + 2] < 250) {
                    
                    hasContent = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        
        // Si hay contenido, recortar
        let canvasFinal = canvas;
        if (hasContent) {
            const width = maxX - minX + 1;
            const height = maxY - minY + 1;
            
            // Crear canvas recortado
            const canvasRecortado = document.createElement('canvas');
            canvasRecortado.width = width;
            canvasRecortado.height = height;
            
            const ctxRecortado = canvasRecortado.getContext('2d');
            ctxRecortado.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
            
            canvasFinal = canvasRecortado;
            console.log(`✂️ Imagen recortada: ${width}x${height} (de ${canvas.width}x${canvas.height})`);
        }
        
        // Mostrar imagen
        const lienzoDestino = document.getElementById('canvasImagen');
        lienzoDestino.width = canvasFinal.width;
        lienzoDestino.height = canvasFinal.height;
        lienzoDestino.getContext('2d').drawImage(canvasFinal, 0, 0);
        
        const imgContainer = document.getElementById('imagenGeneradaContainer');
        imgContainer.style.display = 'block';
        imgContainer.scrollIntoView({ behavior: 'smooth' });
        
        console.log("✅ Imagen generada y optimizada");
        
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

    const nombresSupervisores = supervisoresActuales.length > 0 
        ? supervisoresActuales.map(s => s.nombre || s.Nombre).join(", ")
        : "Sin supervisor";

    const textoCompartir = `📋 Programa Enfermería - ${turnoSeleccionado}\n` +
                          `🕐 ${horarioActual.inicio} a ${horarioActual.fin}\n` +
                          `📅 ${diasCronograma}\n` +
                          `⭐ Supervisor/a: ${nombresSupervisores}`;

    canvas.toBlob(async (blob) => {
        if (!blob) return alert("Error al procesar el archivo de imagen.");
        
        const archivoImagen = new File([blob], `Programa_${turnoSeleccionado}.jpg`, { type: 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [archivoImagen] })) {
            try {
                await navigator.share({
                    files: [archivoImagen],
                    title: `Programa Enfermería - ${turnoSeleccionado}`,
                    text: textoCompartir
                });
            } catch (err) {
                console.log("Compartido cancelado:", err);
            }
        } else {
            alert("Tu navegador no admite compartir archivos de imagen directamente.\n\nUsa 'Descargar Imagen' y adjúntala manualmente en WhatsApp.");
        }
    }, 'image/jpeg', 0.95);
}

function compartirWhatsAppTexto() {
    const nombresSupervisores = supervisoresActuales.length > 0 
        ? supervisoresActuales.map(s => s.nombre || s.Nombre).join(", ")
        : "Sin supervisor";
    
    let bloqueTexto = `📋 *DISTRIBUCIÓN DE ENFERMERÍA*\n`;
    bloqueTexto += `🔄 *Turno:* ${turnoSeleccionado} ${horarioActual.icono}\n`;
    bloqueTexto += `🕐 *Horario:* ${horarioActual.inicio} a ${horarioActual.fin}\n`;
    bloqueTexto += `📅 *Fecha/s:* ${diasCronograma}\n`;
    bloqueTexto += `⭐ *Supervisor/a:* ${nombresSupervisores}\n\n`;

    PISOS.forEach(piso => {
        if (asignaciones[piso] && asignaciones[piso].length > 0) {
            bloqueTexto += `*🏢 PISO ${piso}:*\n`;
            asignaciones[piso].forEach(asig => {
                let icono = '•';
                if (asig.esCambioGuardia) icono = '🔄';
                else if (asig.esExtra) icono = '➕';
                bloqueTexto += `  ${icono} ${asig.texto}\n`;
            });
            bloqueTexto += `\n`;
        }
    });

    if (tercerasAsignadas.length > 0) {
        bloqueTexto += `*📌 TERCERAS / ADICIONALES:*\n`;
        tercerasAsignadas.forEach(t => {
            // Manejar tanto objetos como strings (por compatibilidad)
            const textoTercera = typeof t === 'object' ? t.texto : t;
            bloqueTexto += `  📍 ${textoTercera}\n`;
        });
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(bloqueTexto)}`, '_blank');
}
// === CAMBIAR TURNO SIN SPLASH ===
function cambiarTurno() {
    // Ocultar app
    const mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.style.display = 'none';
    
    // Ocultar imagen generada
    const imgContainer = document.getElementById('imagenGeneradaContainer');
    if (imgContainer) imgContainer.style.display = 'none';
    
    // Resetear variables
    turnoSeleccionado = "";
    supervisoresActuales = [];
    asignaciones = {};
    tercerasAsignadas = [];
    diasCronograma = "";
    horarioActual = null;
    fechasTemporales = [];
    turnoEnProceso = "";
    document.getElementById('horarioDisplay').textContent = "";
    document.getElementById('diasDisplay').textContent = "";
    
    // Limpiar displays
    const turnoDisplay = document.getElementById('turnoDisplay');
    const turnoPrint = document.getElementById('turnoPrint');
    const supervisorDisplay = document.getElementById('supervisorDisplay');
    
    if (turnoDisplay) turnoDisplay.textContent = "";
    if (turnoPrint) turnoPrint.textContent = "";
    if (supervisorDisplay) supervisorDisplay.textContent = "Buscando...";
    
    const selectTerceraTurnoSub = document.getElementById('selectTerceraTurnoSub');
    if (selectTerceraTurnoSub) selectTerceraTurnoSub.style.display = 'none';
    
    // Limpiar grilla
    const pisosGridRows = document.getElementById('pisosGridRows');
    if (pisosGridRows) pisosGridRows.innerHTML = '';
    
    // Limpiar selectores
    const selectTerceraNurse = document.getElementById('selectTerceraNurse');
    const selectTerceraPiso = document.getElementById('selectTerceraPiso');
    if (selectTerceraNurse) selectTerceraNurse.value = "";
    if (selectTerceraPiso) selectTerceraPiso.value = "";
    
    // Mostrar mensaje "No hay personal"
    const noTercerasMsg = document.getElementById('noTercerasMsg');
    if (noTercerasMsg) noTercerasMsg.style.display = 'block';
    
    const tercerasContainer = document.getElementById('tercerasContainer');
    if (tercerasContainer) {
        tercerasContainer.querySelectorAll('.nurse-tag').forEach(el => el.remove());
    }
    
    // Mostrar SOLO modal (sin splash)
    const shiftModal = document.getElementById('shiftModal');
    if (shiftModal) {
        shiftModal.style.display = 'flex';
        
        // Restaurar botones
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
}