/** On-device OCR via Tesseract.js. Photos never leave the phone. */

let workerPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src.includes("tesseract"))) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = resolve;
    el.onerror = () => reject(new Error("Could not load Tesseract.js. Connect once to cache it, then you can go offline."));
    document.head.appendChild(el);
  });
}

export async function ensureOcr(onProgress) {
  if (window.Tesseract && workerPromise) return workerPromise;
  onProgress?.("Loading OCR engine…");
  await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
  workerPromise = window.Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(`Reading photo ${Math.round((m.progress || 0) * 100)}%`);
      }
    },
  });
  const worker = await workerPromise;
  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#.,:$/°%+- ",
    preserve_interword_spaces: "1",
  });
  return worker;
}

export function preprocessImage(file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        let y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        y = (y - 128) * 1.35 + 128;
        y = Math.max(0, Math.min(255, y));
        d[i] = d[i + 1] = d[i + 2] = y;
      }
      ctx.putImageData(data, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve({ canvas, blob, previewUrl: canvas.toDataURL("image/jpeg", 0.7) }), "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

export async function recognizeFile(file, onProgress) {
  const pre = await preprocessImage(file);
  const worker = await ensureOcr(onProgress);
  onProgress?.("Reading photo…");
  const result = await worker.recognize(pre.canvas);
  return {
    text: result.data?.text || "",
    confidence: result.data?.confidence || 0,
    previewUrl: pre.previewUrl,
  };
}
