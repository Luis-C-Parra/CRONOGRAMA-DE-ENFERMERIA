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

// === PREGUNTAR DÍAS PARA SADOFE ===
function preguntarDiasSadofe() {
    return new Promise((resolve) => {
        // Paso 1: Preguntar por feriados
        const tieneFeriados = confirm(
            "🏥 CRONOGRAMA SADOFE\n\n" +
            "¿El cronograma incluye días feriados?\n\n" +
            "• OK = Sí, hay feriados a integrar\n" +
            "• Cancelar = Solo Sábado y Domingo"
        );
        
        if (!tieneFeriados) {
            // Solo fin de semana
            const proximoSabado = obtenerProximoDiaSemana(6); // 6 = Sábado
            const proximoDomingo = obtenerProximoDiaSemana(0); // 0 = Domingo
            
            const dias = `Sábado ${proximoSabado.dia} y Domingo ${proximoDomingo.dia} de ${proximoSabado.mes}`;
            resolve(dias);
        } else {
            // Preguntar qué feriados
            const diasFeriados = prompt(
                "📅 INGRESE LOS DÍAS DEL CRONOGRAMA\n\n" +
                "Ejemplos:\n" +
                "• Sábado 28 y Domingo 29 de Junio\n" +
                "• Sábado 28, Domingo 29 y Lunes 30 (Feriado)\n" +
                "• Viernes 27 al Lunes 30 de Junio\n\n" +
                "Escriba los días completos:"
            );
            
            if (diasFeriados === null || diasFeriados.trim() === "") {
                alert("❌ Operación cancelada. Debe ingresar los días.");
                resolve(null);
            } else {
                resolve(diasFeriados.trim());
            }
        }
    });
}

// === FUNCION AUXILIAR: OBTENER PRÓXIMO DÍA DE LA SEMANA ===
function obtenerProximoDiaSemana(diaSemana) {
    const hoy = new Date();
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    let diasHasta = diaSemana - hoy.getDay();
    if (diasHasta < 0) diasHasta += 7;
    if (diasHasta === 0 && hoy.getHours() >= 12) diasHasta += 7;
    
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + diasHasta);
    
    return {
        dia: fecha.getDate(),
        mes: meses[fecha.getMonth()],
        nombre: dias[fecha.getDay()]
    };
}

// === SELECCIÓN DE TURNO - SIN SPLASH ===
async function selectTurno(turno) {
    turnoSeleccionado = turno.toUpperCase().trim();
    horarioActual = HORARIOS[turnoSeleccionado];
    
    // === PARA SADOFE: PREGUNTAR POR DÍAS Y FERIADOS ===
    if (turnoSeleccionado === "SADOFE") {
        const diasConfirmados = await preguntarDiasSadofe();
        if (!diasConfirmados) {
            // Usuario canceló
            document.getElementById('shiftModal').style.display = 'flex';
            return;
        }
        diasCronograma = diasConfirmados;
    } else {
        // Para otros turnos, usar la fecha actual
        const hoy = new Date();
        const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
        diasCronograma = hoy.toLocaleDateString('es-AR', opciones);
        diasCronograma = diasCronograma.charAt(0).toUpperCase() + diasCronograma.slice(1);
    }
    
    // Ocultar modal y mostrar app
    document.getElementById('shiftModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Actualizar displays
    document.getElementById('turnoDisplay').textContent = turnoSeleccionado;
    document.getElementById('turnoPrint').textContent = turnoSeleccionado;
    
    // Actualizar horario
    document.getElementById('horarioDisplay').textContent = 
        `${horarioActual.inicio} a ${horarioActual.fin}`;
    
    // Actualizar días
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
    console.log("🔍 INICIANDO GENERAR IMAGEN...");
    
    const areaCaptura = document.getElementById('cronogramaContainer');
    if (!areaCaptura) {
        console.error("❌ ERROR: No se encontró 'cronogramaContainer'");
        alert("ERROR: No se pudo encontrar el área de captura.");
        return;
    }
    
    // === CREAR CLON MANUAL ===
    const clon = areaCaptura.cloneNode(true);
    console.log("✅ Clon creado");
    
    // === ELIMINAR ELEMENTOS NO DESEADOS ===
    // 1. Selectores
    clon.querySelectorAll('.cell-selectors').forEach(el => el.remove());
    
    // 2. Controles de terceras
    clon.querySelectorAll('.terceras-controls').forEach(el => el.remove());
    
    // 3. Botones de eliminar
    clon.querySelectorAll('.btn-remove-nurse').forEach(el => el.remove());
    
    // 4. Mensaje "no hay terceras" - USAR querySelector en vez de getElementById
    const noTercerasMsg = clon.querySelector('#noTercerasMsg');
    if (noTercerasMsg) {
        noTercerasMsg.remove();
        console.log("🗑️ Mensaje 'no hay terceras' eliminado");
    }
    
    // 5. Filas vacías
    const filasAntes = clon.querySelectorAll('.grid-row').length;
    clon.querySelectorAll('.grid-row').forEach(row => {
        const tags = row.querySelectorAll('.nurse-tag');
        if (tags.length === 0) {
            row.remove();
        }
    });
    const filasDespues = clon.querySelectorAll('.grid-row').length;
    console.log(`🏢 Filas: ${filasAntes} → ${filasDespues} (eliminadas: ${filasAntes - filasDespues})`);
    
    // 6. Sección Terceras vacía
    const tercerasBlock = clon.querySelector('.terceras-grid-block');
    if (tercerasBlock) {
        const tagsTerceras = tercerasBlock.querySelectorAll('.nurse-tag');
        if (tagsTerceras.length === 0) {
            tercerasBlock.remove();
            console.log("🗑️ Sección Terceras eliminada (vacía)");
        }
    }
    
    // === AGREGAR CLON AL DOM TEMPORALMENTE ===
    clon.id = 'clon-temporal-imagen';
    clon.style.position = 'absolute';
    clon.style.left = '-9999px';
    clon.style.top = '0';
    clon.style.width = '800px';
    clon.style.padding = '20px';
    clon.style.background = '#ffffff';
    clon.style.zIndex = '-1';
    
    document.body.appendChild(clon);
    console.log("✅ Clon agregado al DOM");
    
    // === GENERAR IMAGEN ===
    if (typeof html2canvas === 'undefined') {
        console.error("❌ html2canvas NO está cargado");
        clon.remove();
        alert("ERROR: La librería html2canvas no está cargada.");
        return;
    }
    
    html2canvas(clon, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false
    }).then(canvas => {
        console.log("✅ Imagen generada:", canvas.width, "x", canvas.height);
        
        // Remover clon del DOM
        clon.remove();
        
        const lienzoDestino = document.getElementById('canvasImagen');
        if (!lienzoDestino) {
            alert("ERROR: No se encontró el contenedor de la imagen.");
            return;
        }
        
        lienzoDestino.width = canvas.width;
        lienzoDestino.height = canvas.height;
        lienzoDestino.getContext('2d').drawImage(canvas, 0, 0);
        
        const imgContainer = document.getElementById('imagenGeneradaContainer');
        if (imgContainer) {
            imgContainer.style.display = 'block';
            imgContainer.scrollIntoView({ behavior: 'smooth' });
            console.log("✅ Imagen mostrada");
        }
        
    }).catch(error => {
        console.error("❌ ERROR:", error);
        clon.remove(); // Limpiar en caso de error
        alert(`Error al generar imagen:\n${error.message}`);
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
            asignaciones[piso].forEach(asig => bloqueTexto += `  • ${asig.texto}\n`);
            bloqueTexto += `\n`;
        }
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
    diasCronograma = "";
    horarioActual = null;
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