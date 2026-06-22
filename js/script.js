// === CONFIGURACIÓN ===
const CONFIG = {
    SHEETS_API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbygDIzPCUrIb86Lnww9Q1-U27lrr0oxKDxPmJLJHWuvzmgcJb0eve0fe_FDTSLqNijsMg/exec' 
};

let listaEnfermerosDB = [];
let listaSupervisoresDB = [];

const PISOS = ["1B", "2B", "4B", "1C", "2C", "3C", "4C"];
let turnoSeleccionado = "";
let supervisoresActuales = []; // ARRAY para múltiples supervisores
let asignaciones = {}; 
let tercerasAsignadas = [];
let splashMostrado = false; // Control para no mostrar splash al cambiar turno

/// Variable global


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
function selectTurno(turno) {
    turnoSeleccionado = turno.toUpperCase().trim();
    
    // Ocultar modal, mostrar app
    document.getElementById('shiftModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    document.getElementById('turnoDisplay').textContent = turnoSeleccionado;
    document.getElementById('turnoPrint').textContent = turnoSeleccionado;

    // Buscar supervisores
    supervisoresActuales = listaSupervisoresDB.filter(s => {
        const turnoSup = (s.turno_supervision || s.Turno_Supervision || s.TURNO_SUPERVISION || "").toString();
        return turnoCoincide(turnoSup, turnoSeleccionado);
    });
    
    if (supervisoresActuales.length > 0) {
        const nombresSupervisores = supervisoresActuales.map(s => 
            s.nombre || s.Nombre || "Sin nombre"
        ).join(", ");
        document.getElementById('supervisorDisplay').textContent = nombresSupervisores;
    } else {
        document.getElementById('supervisorDisplay').textContent = "Sin supervisor designado";
    }

    if (turnoSeleccionado === "SADOFE") {
        document.getElementById('selectTerceraTurnoSub').style.display = 'inline-block';
    }

    armarTablaPisos();
    poblarSelectoresTerceras();
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

function agregarTercera() {
    const enfermero = document.getElementById('selectTerceraNurse').value;
    const pisoDestino = document.getElementById('selectTerceraPiso').value;
    
    if (!enfermero || !pisoDestino) return alert("Complete los campos.");

    let plantillaTercera = `Tercera: ${enfermero} -> Piso ${pisoDestino}`;

    if (turnoSeleccionado === "SADOFE") {
        const subTurnoSadofe = document.getElementById('selectTerceraTurnoSub').value;
        if (subTurnoSadofe) {
            plantillaTercera += ` [${subTurnoSadofe === 'MAÑANA' ? '☀️' : '⛅'} ${subTurnoSadofe}]`;
        } else {
            alert("⚠️ Por favor seleccione la franja horaria (Mañana o Tarde) para SADOFE.");
            return;
        }
    }

    tercerasAsignadas.push(plantillaTercera);
    document.getElementById('noTercerasMsg').style.display = 'none';
    renderizarTercerasList();

    document.getElementById('selectTerceraNurse').value = "";
    document.getElementById('selectTerceraPiso').value = "";
    
    // No resetear el select de turno SADOFE para facilitar agregar múltiples
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

// === EXPORTACIONES ===
function generarImagen() {
    const areaCaptura = document.getElementById('cronogramaContainer');
    
    document.querySelectorAll('.cell-selectors').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.terceras-controls').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.btn-remove-nurse').forEach(el => el.style.display = 'none');

    html2canvas(areaCaptura, {
        scale: 2,
        backgroundColor: "#ffffff",
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
    link.href = document.getElementById('canvasImagen').toDataURL('image/jpeg', 0.95);
    link.click();
}

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
                    text: `Distribución del personal. Supervisor/a: ${supervisoresActuales.map(s => s.nombre || s.Nombre).join(", ")}.`
                });
            } catch (err) {
                console.log("Compartido cancelado o error en transferencia:", err);
            }
        } else {
            alert("Tu navegador o dispositivo no admite compartir archivos de imagen directamente.\n\nPor favor, usa el botón azul 'Descargar Imagen' y adjúntala manualmente en tu WhatsApp.");
        }
    }, 'image/jpeg', 0.95);
}

function compartirWhatsAppTexto() {
    const nombresSupervisores = supervisoresActuales.length > 0 
        ? supervisoresActuales.map(s => s.nombre || s.Nombre).join(", ")
        : "Sin supervisor";
    
    let bloqueTexto = `📋 *DISTRIBUCIÓN DE ENFERMERÍA - TURNO ${turnoSeleccionado}*\n`;
    bloqueTexto += `⭐ *Supervisor/a:* ${nombresSupervisores}\n`;
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