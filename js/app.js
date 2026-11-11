/* CONFIGURACIÓN: personaliza estos valores antes de publicar. */
const CONFIG = {
  institution: "INSTITUCIÓN",
  title: "Instructivo institucional",
  description: "Consulta los documentos en orden. Al completar los ocho apartados podrás continuar al formulario correspondiente.",
  formUrl: "PEGA_AQUI_TU_URL_DE_APPS_SCRIPT_EXEC",
  documents: [
    { title: "Instructivo 1", file: "assets/documentos/01.pdf" },
    { title: "Instructivo 2", file: "assets/documentos/02.pdf" },
    { title: "Instructivo 3", file: "assets/documentos/03.pdf" },
    { title: "Instructivo 4", file: "assets/documentos/04.pdf" },
    { title: "Instructivo 5", file: "assets/documentos/05.pdf" }
  ]
};

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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

$("institution-name").textContent = CONFIG.institution;
$("footer-institution").textContent = CONFIG.institution;
$("guide-title").textContent = CONFIG.title;
$("guide-description").textContent = CONFIG.description;

function renderStepNavigation() {
  $("step-nav").innerHTML = "";
  CONFIG.documents.forEach((doc, index) => {
    const button = document.createElement("button");
    button.className = "step-pill";
    button.textContent = `${String(index + 1).padStart(2, "0")}`;
    button.title = doc.title;
    button.disabled = index > currentStep;
    if (index === currentStep) button.classList.add("active");
    if (completed.has(index)) button.classList.add("done");
    button.addEventListener("click", () => {
      if (index <= currentStep) loadStep(index);
    });
    $("step-nav").appendChild(button);
  });
}

async function renderPage() {
  if (!pdfDocument) return;
  const page = await pdfDocument.getPage(currentPage);
  const viewport = page.getViewport({ scale: zoom });
  const canvas = $("pdf-canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  $("pdf-page-wrap").style.width = `${viewport.width}px`;
  $("pdf-page-wrap").style.height = `${viewport.height}px`;
  await page.render({ canvasContext: context, viewport }).promise;

  // Capa de anotaciones: conserva enlaces externos e internos del PDF.
  const annotationLayer = $("pdf-annotations");
  annotationLayer.innerHTML = "";
  const annotations = await page.getAnnotations({ intent: "display" });
  annotations.filter(item => item.subtype === "Link" && item.rect).forEach(item => {
    const rect = viewport.convertToViewportRectangle(item.rect);
    const left = Math.min(rect[0], rect[2]);
    const top = Math.min(rect[1], rect[3]);
    const link = document.createElement("a");
    link.style.left = `${left}px`;
    link.style.top = `${top}px`;
    link.style.width = `${Math.abs(rect[2] - rect[0])}px`;
    link.style.height = `${Math.abs(rect[3] - rect[1])}px`;
    link.setAttribute("aria-label", "Abrir vínculo del documento");

    if (item.url) {
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else if (item.dest) {
      link.href = "#";
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          const destination = typeof item.dest === "string"
            ? await pdfDocument.getDestination(item.dest)
            : item.dest;
          if (destination) {
            const pageIndex = await pdfDocument.getPageIndex(destination[0]);
            currentPage = pageIndex + 1;
            await renderPage();
          }
        } catch (error) {
          console.warn("No fue posible resolver el vínculo interno:", error);
        }
      });
    } else {
      return;
    }
    annotationLayer.appendChild(link);
  });

  $("page-indicator").textContent = `Página ${currentPage} de ${totalPages}`;
  $("page-prev").disabled = currentPage <= 1;
  $("page-next").disabled = currentPage >= totalPages;
  $("zoom-label").textContent = `${Math.round(zoom * 100)}%`;
}

async function loadStep(index) {
  currentStep = index;
  currentPage = 1;
  zoom = window.innerWidth < 700 ? 0.72 : 1;
  const doc = CONFIG.documents[index];

  $("step-heading").textContent = `Apartado ${index + 1}`;
  $("document-kicker").textContent = `DOCUMENTO ${String(index + 1).padStart(2, "0")}`;
  $("document-title").textContent = doc.title;
  $("download-link").href = doc.file;
  $("pdf-loading").hidden = false;
  $("pdf-error").hidden = true;
  $("pdf-canvas").hidden = true;
  $("step-complete").checked = completed.has(index);
  $("previous-step").disabled = index === 0;
  $("next-step").disabled = !completed.has(index);
  $("next-step").textContent = index === CONFIG.documents.length - 1 ? "Finalizar recorrido →" : "Siguiente apartado →";

  try {
    pdfDocument = await pdfjsLib.getDocument(doc.file).promise;
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

function renderProgress() {
  const count = completed.size;
  $("progress-count").textContent = `${count} de ${CONFIG.documents.length} completados`;
  $("progress-fill").style.width = `${(count / CONFIG.documents.length) * 100}%`;
}

$("start-button").addEventListener("click", () => {
  intro.hidden = true;
  workspace.hidden = false;
  loadStep(0);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("step-complete").addEventListener("change", (event) => {
  if (event.target.checked) completed.add(currentStep);
  else completed.delete(currentStep);
  $("next-step").disabled = !completed.has(currentStep);
  renderProgress();
  renderStepNavigation();
});

$("previous-step").addEventListener("click", () => {
  if (currentStep > 0) loadStep(currentStep - 1);
});

$("next-step").addEventListener("click", () => {
  if (!completed.has(currentStep)) return;
  if (currentStep < CONFIG.documents.length - 1) loadStep(currentStep + 1);
  else {
    workspace.hidden = true;
    finish.hidden = false;
    $("form-link").href = CONFIG.formUrl;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

$("page-prev").addEventListener("click", async () => {
  if (currentPage > 1) { currentPage--; await renderPage(); }
});
$("page-next").addEventListener("click", async () => {
  if (currentPage < totalPages) { currentPage++; await renderPage(); }
});
$("zoom-in").addEventListener("click", async () => {
  zoom = Math.min(zoom + 0.15, 2.2); await renderPage();
});
$("zoom-out").addEventListener("click", async () => {
  zoom = Math.max(zoom - 0.15, 0.5); await renderPage();
});
$("restart-button").addEventListener("click", () => {
  finish.hidden = true;
  workspace.hidden = false;
  loadStep(0);
  window.scrollTo({ top: 0, behavior: "smooth" });
});
