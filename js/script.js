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

// === FLUJO DE INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', function() {
    const modalBox = document.querySelector('.modal-box');
    if (modalBox) {
        modalBox.innerHTML = `
            <h2 id="modalStatusTitle">🔄 Cargando Base de Datos...</h2>
            <p style="color: #7f8c8d; margin-top: 10px;">Conectando con Google Sheets...</p>
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
        const data = await response.json();
        
        console.log("📊 DATOS RECIBIDOS COMPLETOS:", data);
        console.log("🔑 CLAVES del JSON:", Object.keys(data));
        
        // DIAGNÓSTICO: Mostrar qué estructura tiene
        if (data.enfermeros && data.enfermeros.length > 0) {
            console.log("👥 Primer enfermero:", data.enfermeros[0]);
            console.log("🔑 Propiedades del primer enfermero:", Object.keys(data.enfermeros[0]));
        }
        
        // Intentar diferentes estructuras posibles
        if (data.enfermeros) {
            listaEnfermerosDB = data.enfermeros;
        } else if (data.Enfermeros) {
            listaEnfermerosDB = data.Enfermeros;
        } else if (data.data) {
            listaEnfermerosDB = data.data;
        } else if (Array.isArray(data)) {
            listaEnfermerosDB = data;
        }
        
        if (data.supervisores) {
            listaSupervisoresDB = data.supervisores;
        } else if (data.Supervisores) {
            listaSupervisoresDB = data.Supervisores;
        }
        
        console.log(`✅ Enfermeros cargados: ${listaEnfermerosDB.length}`);
        console.log(`✅ Supervisores cargados: ${listaSupervisoresDB.length}`);
        
        // MOSTRAR TURNOS ÚNICOS ENCONTRADOS
        const turnosUnicos = [...new Set(listaEnfermerosDB.map(e => e.turno || e.Turno || e.TURNO || "SIN TURNO"))];
        console.log("🎯 TURNOS ÚNICOS encontrados en la base:", turnosUnicos);
        
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

// === FUNCIÓN PARA OBTENER EL TURNO DEL ENFERMERO (FLEXIBLE) ===
function obtenerTurnoEnfermero(enfermero) {
    // Probar diferentes nombres de propiedad
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

// === FUNCIÓN PARA COMPARAR TURNOS DE FORMA FLEXIBLE ===
function turnoCoincide(turnoEnfermero, turnoSeleccionado) {
    if (!turnoEnfermero || !turnoSeleccionado) return false;
    
    const t1 = turnoEnfermero.toString().toUpperCase().trim();
    const t2 = turnoSeleccionado.toString().toUpperCase().trim();
    
    // Comparación exacta
    if (t1 === t2) return true;
    
    // Comparación sin tildes
    const t1Normal = t1.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const t2Normal = t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t1Normal === t2Normal) return true;
    
    // Comparación parcial (por si dice "MAÑANA" vs "M" o "MANANA")
    if (t1.includes(t2) || t2.includes(t1)) return true;
    if (t1Normal.includes(t2Normal) || t2Normal.includes(t1Normal)) return true;
    
    return false;
}

// === CONTROLADORES DE TURNO ===
function selectTurno(turno) {
    turnoSeleccionado = turno.toUpperCase().trim();
    document.getElementById('shiftModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    document.getElementById('turnoDisplay').textContent = turnoSeleccionado;
    document.getElementById('turnoPrint').textContent = turnoSeleccionado;

    // Buscar supervisor
    const supervisorEncontrado = listaSupervisoresDB.find(s => {
        const turnoSup = (s.turno_supervision || s.Turno_Supervision || s.TURNO_SUPERVISION || "").toString();
        return turnoCoincide(turnoSup, turnoSeleccionado);
    });
    
    supervisorActual = supervisorEncontrado 
        ? (supervisorEncontrado.nombre || supervisorEncontrado.Nombre || "Sin nombre")
        : "Sin supervisor designado";
    document.getElementById('supervisorDisplay').textContent = supervisorActual;

    if (turnoSeleccionado === "SADOFE") {
        document.getElementById('selectTerceraTurnoSub').style.display = 'inline-block';
    }

    armarTablaPisos();
    poblarSelectoresTerceras();
}

function armarTablaPisos() {
    console.log("🔧 INICIANDO armarTablaPisos()");
    console.log("📊 listaEnfermerosDB:", listaEnfermerosDB);
    console.log("🎯 turnoSeleccionado:", turnoSeleccionado);
    
    const tableBody = document.getElementById('pisosGridRows');
    if (!tableBody) {
        console.error("❌ ERROR: No se encontró el elemento 'pisosGridRows'");
        alert("ERROR: No se pudo cargar la grilla de pisos. Recarga la página.");
        return;
    }
    
    tableBody.innerHTML = '';

    // FILTRADO FLEXIBLE
    const titulares = listaEnfermerosDB.filter(e => {
        const turno = obtenerTurnoEnfermero(e);
        return turnoCoincide(turno, turnoSeleccionado);
    });

    const extras = listaEnfermerosDB.filter(e => {
        const turno = obtenerTurnoEnfermero(e);
        return !turnoCoincide(turno, turnoSeleccionado);
    });

    console.log(`\n🎯 FILTRADO PARA TURNO: ${turnoSeleccionado}`);
    console.log(`✅ TITULARES encontrados: ${titulares.length}`, titulares);
    console.log(`✅ EXTRAS encontrados: ${extras.length}`, extras);

    if (listaEnfermerosDB.length === 0) {
        alert("⚠️ NO HAY DATOS CARGADOS\n\nLa base de datos de enfermeros está vacía.\n\nVerifica que:\n1. Google Sheets tenga datos\n2. El script de Google Apps esté publicado\n3. La URL del API sea correcta\n\nAbre la consola (F12) para más detalles.");
    } else if (titulares.length === 0) {
        alert(`⚠️ SIN TITULARES PARA "${turnoSeleccionado}"\n\nSe encontraron ${extras.length} enfermeros EXTRA pero 0 TITULARES.\n\nEsto pasa porque los turnos en Google Sheets no coinciden con "${turnoSeleccionado}".\n\nRevisa la consola (F12) para ver qué turnos hay en la base de datos.`);
    }

    PISOS.forEach((piso, index) => {
        console.log(`\n📍 Creando fila para piso ${piso} (${index + 1}/${PISOS.length})`);
        
        asignaciones[piso] = [];

        const row = document.createElement('div');
        row.className = 'grid-row';
        
        // Opciones para titulares
        let opcionesTitulares = '<option value="">+ Titular</option>';
        if (titulares.length === 0) {
            opcionesTitulares = '<option value="" disabled>⚠️ Sin titulares</option>';
        } else {
            titulares.forEach(e => {
                const nombre = obtenerNombreEnfermero(e);
                opcionesTitulares += `<option value="${nombre}">${nombre}</option>`;
            });
        }
        
        // Opciones para extras
        let opcionesExtras = '<option value="">+ Extra</option>';
        if (extras.length === 0) {
            opcionesExtras = '<option value="" disabled>⚠️ Sin extras</option>';
        } else {
            extras.forEach(e => {
                const nombre = obtenerNombreEnfermero(e);
                const turno = obtenerTurnoEnfermero(e);
                opcionesExtras += `<option value="${nombre}">${nombre} (${turno})</option>`;
            });
        }

        row.innerHTML = `
            <div class="grid-td-piso">${piso}</div>
            <div class="grid-td-assignments">
                <div id="cell-list-${piso}" style="display:contents;"></div>
                
                <div class="cell-selectors no-print" style="display: flex; gap: 10px; margin-top: 10px; border-top: 2px dashed #D1D5DB; padding-top: 12px;">
                    <select id="select-titular-${piso}" onchange="registrarEnfermero('${piso}', this, false)" style="flex: 1; padding: 14px 12px; font-size: 1rem; border: 2px solid #D1D5DB; border-radius: 12px; background: white; font-weight: 600;">
                        ${opcionesTitulares}
                    </select>
                    <select id="select-extra-${piso}" onchange="registrarEnfermero('${piso}', this, true)" style="flex: 1; padding: 14px 12px; font-size: 1rem; border: 2px solid #D1D5DB; border-radius: 12px; background: white; font-weight: 600;">
                        ${opcionesExtras}
                    </select>
                </div>
            </div>
        `;
        
        console.log(`✅ Fila ${piso} creada exitosamente`);
        tableBody.appendChild(row);
    });
    
    console.log("✅ armarTablaPisos() completado");
    console.log(`📊 Total de filas creadas: ${PISOS.length}`);
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