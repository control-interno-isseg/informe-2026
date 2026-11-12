
/* =========================================================
   CONFIGURACIÓN GENERAL
   ========================================================= */

const CONFIG = {
    institution: "Instituto de Seguridad Social del Estado de Guanajuato",
    title: "Instructivo para la carga documental del Informe de Control Interno 2026",
    description: "Esta herramienta ha sido diseñada para orientar y facilitar, de manera secuencial e interactiva, la integración del Informe de Control Interno 2026, mediante el registro puntual, preciso y ordenado de la información requerida.",

    formUrl: "https://script.google.com/a/macros/isseg.gob.mx/s/AKfycbzQd2sPuD8mnx4AYlfbe-1r21epjOh7TQTcNgqV58Lu09L9X2yvL0U7fn1pIon4I7P_/exec",

    documents: [
        { title: "Usa tu correo institucional", file: "assets/documentos/01.pdf" },
        { title: "Encuentra tu área en el desplegable", file: "assets/documentos/02.pdf" },
        { title: "Consulta el total de tus requerimientos", file: "assets/documentos/03.pdf" },
        { title: "Revisa la redacción y fechas límite", file: "assets/documentos/04.pdf" },
        { title: "Carga evidencias y actualiza", file: "assets/documentos/05.pdf" }
    ]
};


/* =========================================================
   CONFIGURACIÓN PDF.JS
   ========================================================= */

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


/* =========================================================
   VARIABLES GENERALES
   ========================================================= */

const $ = (id) => document.getElementById(id);

let currentStep = 0;
let currentPage = 1;
let totalPages = 1;
let zoom = 1;
let pdfDocument = null;

const completed = new Set();

const intro = $("intro");
const workspace = $("workspace");
const finish = $("finish");


/* =========================================================
   IDENTIDAD INSTITUCIONAL
   ========================================================= */

$("institution-name").textContent = CONFIG.institution;
$("footer-institution").textContent = CONFIG.institution;
$("guide-title").textContent = CONFIG.title;
$("guide-description").textContent = CONFIG.description;


/* =========================================================
   ZOOM AUTOMÁTICO SEGÚN DISPOSITIVO
   Escritorio: 70 %
   Móviles: 50 %
   ========================================================= */

function getInitialZoom() {

    const isMobile = window.matchMedia(
        "(max-width: 768px)"
    ).matches;

    return isMobile ? 0.50 : 0.70;
}


/* =========================================================
   NAVEGACIÓN ENTRE DOCUMENTOS
   ========================================================= */

function renderStepNavigation() {

    $("step-nav").innerHTML = "";

    CONFIG.documents.forEach((doc, index) => {

        const button = document.createElement("button");

        button.className = "step-pill";

        button.textContent = String(index + 1).padStart(2, "0");

        button.title = doc.title;

        button.disabled = index > currentStep;

        if (index === currentStep) {
            button.classList.add("active");
        }

        if (completed.has(index)) {
            button.classList.add("done");
        }

        button.addEventListener("click", () => {

            if (index <= currentStep) {
                loadStep(index);
            }

        });

        $("step-nav").appendChild(button);

    });

}


/* =========================================================
   RENDERIZADO DE PÁGINAS PDF
   Sin capa de hipervínculos
   ========================================================= */

async function renderPage() {

    if (!pdfDocument) return;

    const page = await pdfDocument.getPage(currentPage);

    const viewport = page.getViewport({
        scale: zoom
    });

    const canvas = $("pdf-canvas");

    const context = canvas.getContext("2d");

    // Resolución adicional para pantallas de alta densidad.
    const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        2
    );

    canvas.width = Math.floor(
        viewport.width * pixelRatio
    );

    canvas.height = Math.floor(
        viewport.height * pixelRatio
    );

    // Tamaño visual de la página.
    canvas.style.width = `${viewport.width}px`;

    canvas.style.height = `${viewport.height}px`;

    $("pdf-page-wrap").style.width =
        `${viewport.width}px`;

    $("pdf-page-wrap").style.height =
        `${viewport.height}px`;

    // Renderizado del PDF.
    await page.render({

        canvasContext: context,

        viewport: viewport,

        transform: pixelRatio !== 1
            ? [pixelRatio, 0, 0, pixelRatio, 0, 0]
            : null

    }).promise;

    // Actualización de controles.
    $("page-indicator").textContent =
        `Página ${currentPage} de ${totalPages}`;

    $("page-prev").disabled =
        currentPage <= 1;

    $("page-next").disabled =
        currentPage >= totalPages;

    $("zoom-label").textContent =
        `${Math.round(zoom * 100)}%`;

}


/* =========================================================
   CARGA DE DOCUMENTOS
   ========================================================= */

async function loadStep(index) {

    currentStep = index;

    currentPage = 1;

    // Restablecer zoom según el dispositivo.
    zoom = getInitialZoom();

    const doc = CONFIG.documents[index];

    $("document-title").textContent =
        doc.title;

    $("pdf-loading").hidden = false;

    $("pdf-error").hidden = true;

    $("pdf-canvas").hidden = true;

    $("step-complete").checked =
        completed.has(index);

    $("previous-step").disabled =
        index === 0;

    $("next-step").disabled =
        !completed.has(index);

    $("next-step").textContent =
        index === CONFIG.documents.length - 1
            ? "Finalizar recorrido →"
            : "Siguiente apartado →";

    try {

        // Carga del PDF correspondiente.
        pdfDocument = await pdfjsLib.getDocument(
            doc.file
        ).promise;

        totalPages = pdfDocument.numPages;

        $("pdf-loading").hidden = true;

        $("pdf-canvas").hidden = false;

        await renderPage();

    } catch (error) {

        console.error("Error al cargar PDF:", error);

        $("pdf-loading").hidden = true;

        $("pdf-error").hidden = false;

    }

    renderProgress();

    renderStepNavigation();

}


/* =========================================================
   PROGRESO GENERAL
   ========================================================= */

function renderProgress() {

    const count = completed.size;

    $("progress-count").textContent =
        `${count} de ${CONFIG.documents.length} completados`;

    $("progress-fill").style.width =
        `${(count / CONFIG.documents.length) * 100}%`;

}


/* =========================================================
   INICIAR RECORRIDO
   ========================================================= */

$("start-button").addEventListener("click", () => {

    intro.hidden = true;

    workspace.hidden = false;

    loadStep(0);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

});


/* =========================================================
   MARCAR DOCUMENTO COMO REVISADO
   ========================================================= */

$("step-complete").addEventListener("change", (event) => {

    if (event.target.checked) {

        completed.add(currentStep);

    } else {

        completed.delete(currentStep);

    }

    $("next-step").disabled =
        !completed.has(currentStep);

    renderProgress();

    renderStepNavigation();

});


/* =========================================================
   DOCUMENTO ANTERIOR
   ========================================================= */

$("previous-step").addEventListener("click", () => {

    if (currentStep > 0) {

        loadStep(currentStep - 1);

    }

});


/* =========================================================
   SIGUIENTE DOCUMENTO / FINALIZAR
   ========================================================= */

$("next-step").addEventListener("click", () => {

    if (!completed.has(currentStep)) return;

    if (currentStep < CONFIG.documents.length - 1) {

        loadStep(currentStep + 1);

    } else {

        workspace.hidden = true;

        finish.hidden = false;

        $("form-link").href = CONFIG.formUrl;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

});


/* =========================================================
   NAVEGACIÓN ENTRE PÁGINAS DEL PDF
   ========================================================= */

$("page-prev").addEventListener("click", async () => {

    if (currentPage > 1) {

        currentPage--;

        await renderPage();

    }

});


$("page-next").addEventListener("click", async () => {

    if (currentPage < totalPages) {

        currentPage++;

        await renderPage();

    }

});


/* =========================================================
   CONTROLES DE ZOOM MANUAL
   ========================================================= */

$("zoom-in").addEventListener("click", async () => {

    zoom = Math.min(zoom + 0.15, 2.2);

    await renderPage();

});


$("zoom-out").addEventListener("click", async () => {

    zoom = Math.max(zoom - 0.15, 0.35);

    await renderPage();

});


/* =========================================================
   REINICIAR RECORRIDO
   ========================================================= */

$("restart-button").addEventListener("click", () => {

    finish.hidden = true;

    workspace.hidden = false;

    loadStep(0);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

});
