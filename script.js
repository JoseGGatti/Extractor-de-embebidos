// ===========================
// --- Listener de archivo ---
// ===========================

document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];

  const output = document.getElementById("output");
  const error = document.getElementById("error");

  output.classList.add("d-none");
  error.classList.add("d-none");

  if (!file) {
    showError("No se seleccionó ningún archivo.");
    return;
  }

  try {
    if (file.type === "application/pdf") {
      const embeds = await extractPDFEmbeds(file);
      showResults(embeds, "PDF");
    } 
    else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const embeds = await extractDocxEmbeds(file);
      showResults(embeds, "DOCX");
    } 
    else {
      showError("Formato no soportado. Solo PDF y DOCX.");
    }

  } catch (err) {
    console.error(err);
    showError("Hubo un error procesando el archivo.");
  }
});


// ===========================
// --- Función para mostrar ---
// ===========================

function showError(msg) {
  const error = document.getElementById("error");
  error.classList.remove("d-none");
  error.textContent = msg;
}

function showResults(embeds, type) {
  const output = document.getElementById("output");
  output.classList.remove("d-none");

  if (embeds.length === 0) {
    output.innerHTML = `<strong>No se encontraron archivos embebidos en el ${type}.</strong>`;
    return;
  }

  output.innerHTML = `<strong>Archivos embebidos encontrados:</strong><br>`;

  embeds.forEach(({ name, blob }) => {
    const url = URL.createObjectURL(blob);

    // 🔥 AGREGO .pdf SI NO VIENE CON EXTENSIÓN
    const fixedName = name.toLowerCase().endsWith(".pdf") ? name : name + ".pdf";

    output.innerHTML += `<a href="${url}" download="${fixedName}">📎 Descargar ${fixedName}</a><br>`;
  });
}



// ================================
// === EXTRACTOR DE DOCX COMPLETO ===
// ================================

async function extractDocxEmbeds(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const embeddings = zip.folder("word/embeddings");

  const results = [];
  if (!embeddings) return results;

  const files = embeddings.filter((path, f) => f.name);

  for (let fullPath of files) {
    const fileEntry = zip.file(fullPath);
    if (fileEntry) {
      const blob = await fileEntry.async("blob");
      results.push({
        name: fullPath.split("/").pop(),
        blob,
      });
    }
  }

  return results;
}



// ===================================
// === EXTRACTOR PDF COMPLETO (FIX) ===
// ===================================

async function extractPDFEmbeds(file) {
  const buffer = await file.arrayBuffer();
  
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const results = [];

  // -----------------------------------
  // 1) EXTRAE "Attachments" ESTÁNDAR
  // -----------------------------------
  const attachments = await pdf.getAttachments();

  if (attachments) {
    for (const name in attachments) {
      const item = attachments[name];

      let mime = item.contentType || "application/octet-stream";
      if (name.toLowerCase().endsWith(".pdf")) mime = "application/pdf";

      results.push({
        name,
        blob: new Blob([item.content], { type: mime })
      });
    }
  }


  // -----------------------------------
  // 2) EXTRAE ARCHIVOS EN ANOTACIONES
  // -----------------------------------
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const annotations = await page.getAnnotations();

    for (const a of annotations) {
      if (a.file) {
        const fileSpec = a.file;

        const name = fileSpec.filename || "archivo_embebido.bin";
        const data = fileSpec.content;

        let mime = "application/octet-stream";
        if (name.toLowerCase().endsWith(".pdf")) mime = "application/pdf";

        results.push({
          name,
          blob: new Blob([data], { type: mime }),
        });
      }
    }
  }

  return results;
}
