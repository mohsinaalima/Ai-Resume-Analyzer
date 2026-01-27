// app/lib/pdf2img.ts
export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

let pdfjsLib: any = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;

  try {
    // Import the main library
    const lib = await import("pdfjs-dist/build/pdf.mjs");

    // Point to the worker file in your /public folder
    lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    pdfjsLib = lib;
    return lib;
  } catch (err) {
    console.error("Failed to load PDF.js library:", err);
    throw err;
  }
}

export async function convertPdfToImage(
  file: File,
): Promise<PdfConversionResult> {
  try {
    const lib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();

    // Load document
    const loadingTask = lib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    // Get the first page
    const page = await pdf.getPage(1);

    // Setup canvas
    const viewport = page.getViewport({ scale: 2 }); // Scale 2 is usually enough for AI
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) throw new Error("Could not create canvas context");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render PDF page to canvas
    await page.render({ canvasContext: context, viewport }).promise;

    // Convert canvas to Blob then File
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const originalName = file.name.replace(/\.pdf$/i, "");
          const imageFile = new File([blob], `${originalName}.png`, {
            type: "image/png",
          });

          resolve({
            imageUrl: URL.createObjectURL(blob),
            file: imageFile,
          });
        } else {
          resolve({
            imageUrl: "",
            file: null,
            error: "Canvas to Blob conversion failed",
          });
        }
      }, "image/png");
    });
  } catch (err) {
    console.error("PDF Conversion Detail:", err);
    return {
      imageUrl: "",
      file: null,
      error: `Conversion Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
