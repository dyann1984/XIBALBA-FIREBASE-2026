// Preparación local de imágenes. Todo ocurre en memoria: no hay subida,
// almacenamiento ni copia en disco. El envío al modelo requiere el
// consentimiento explícito que gestiona la interfaz.

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2048;
export const MAX_IMAGES = 3;

export type PreparedImage = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  /** URL de objeto local, solo para la vista previa. Hay que revocarla. */
  previewUrl: string;
  /** Contenido en base64, sin el prefijo `data:`. */
  base64: string;
};

/** Usa OCR nativo solo cuando el navegador lo ofrece; las imágenes permanecen en el dispositivo. */
export type OcrResult = { text: string; status: 'available' | 'empty' | 'unavailable' | 'error'; source?: 'native' | 'tesseract' | 'model'; confidence?: number; partial?: boolean };
export async function recognizeImageText(images: PreparedImage[]): Promise<OcrResult> {
  if (!images.length) return { text: '', status: 'unavailable' };
  type Detector = { detect(source: ImageBitmap): Promise<{ rawValue?: string }[]> };
  const NativeDetector = (globalThis as typeof globalThis & { TextDetector?: new () => Detector }).TextDetector;
  if (NativeDetector && typeof createImageBitmap === 'function') try {
    const detector = new NativeDetector();
    const texts: string[] = [];
    for (const image of images) {
      const response = await fetch(image.previewUrl);
      const bitmap = await createImageBitmap(await response.blob());
      try { texts.push((await detector.detect(bitmap)).map(line => line.rawValue ?? '').filter(Boolean).join('\n')); }
      finally { bitmap.close(); }
    }
    const text = texts.filter(Boolean).join('\n\n').slice(0, 12000);
    if (text.trim()) return { text, status: 'available', source: 'native', partial: images.length > 1 };
  } catch { /* Continúa con el OCR WASM local. */ }
  if (typeof window === 'undefined') return { text: '', status: 'unavailable' };
  let worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | undefined;
  try {
    const { createWorker } = await import('tesseract.js');
    worker = await createWorker(['spa', 'eng'], 1, {
      workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang',
      workerBlobURL: false, gzip: false, cacheMethod: 'none',
    });
    const texts: string[] = [];
    const confidence: number[] = [];
    let failed = 0;
    for (const image of images) {
      try {
        const result = await worker.recognize(image.previewUrl);
        const text = result.data.text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
        if (text) { texts.push(text); confidence.push(result.data.confidence); } else failed++;
      } catch { failed++; }
    }
    const joined = texts.join('\n\n');
    return { text: joined.slice(0, 12000), status: joined ? 'available' : 'empty', source: 'tesseract', confidence: confidence.length ? confidence.reduce((a, b) => a + b, 0) / confidence.length : undefined, partial: failed > 0 || joined.length > 12000 };
  } catch { return { text: '', status: 'error', source: 'tesseract' }; }
  finally { await worker?.terminate(); }
}

const EXT_TO_MIME: Record<string, (typeof ALLOWED_IMAGE_TYPES)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Resuelve el MIME real aunque el navegador móvil entregue `type` vacío. */
export function resolveImageMimeType(file: Pick<File, 'name' | 'type'>): string {
  if (file.type && (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  if (!file.type || file.type === 'application/octet-stream') {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext in EXT_TO_MIME) return EXT_TO_MIME[ext];
  }
  return file.type || '';
}

/** Devuelve el motivo del rechazo, o `null` si el archivo es aceptable. */
export function describeImageRejection(
  file: Pick<File, 'name' | 'type' | 'size'>,
  lang: 'es' | 'en' = 'es',
): string | null {
  const mime = resolveImageMimeType(file);
  const label = file.name || (lang === 'en' ? 'file' : 'archivo');
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime)) {
    return lang === 'en'
      ? `«${label}» is not JPEG, PNG, or WebP. Select a supported image.`
      : `«${label}» no es JPEG, PNG ni WebP. Selecciona una imagen en uno de esos formatos.`;
  }
  if (file.size === 0) {
    return lang === 'en' ? `«${label}» is empty.` : `«${label}» está vacío.`;
  }
  if (file.size > MAX_RAW_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const maxMb = MAX_RAW_IMAGE_BYTES / 1024 / 1024;
    return lang === 'en'
      ? `«${label}» is ${mb} MB and exceeds the ${maxMb} MB maximum.`
      : `«${label}» pesa ${mb} MB y supera el máximo de ${maxMb} MB.`;
  }
  return null;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen en el dispositivo.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function measure(file: Blob): Promise<{ width?: number; height?: number }> {
  if (typeof createImageBitmap !== 'function') return {};
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return {};
  }
}

async function compressIfNeeded(
  file: File,
  mimeType: string,
  size: { width?: number; height?: number },
): Promise<{ blob: Blob; mimeType: string; width?: number; height?: number }> {
  const needsResize =
    (size.width !== undefined && size.width > MAX_IMAGE_EDGE) ||
    (size.height !== undefined && size.height > MAX_IMAGE_EDGE);
  const needsCompress = file.size > MAX_IMAGE_BYTES || needsResize;

  if (!needsCompress || typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { blob: file, mimeType, width: size.width, height: size.height };
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, mimeType, width: size.width, height: size.height };
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.86, 0.72, 0.56]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((value) => resolve(value), 'image/jpeg', quality),
      );
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        return { blob, mimeType: 'image/jpeg', width, height };
      }
    }
    throw new Error(
      `«${file.name || 'archivo'}» supera ${MAX_IMAGE_BYTES / 1024 / 1024} MB incluso tras optimizarla.`,
    );
  } finally {
    bitmap.close?.();
  }
}

let counter = 0;

export async function prepareImage(file: File, lang: 'es' | 'en' = 'es'): Promise<PreparedImage> {
  const rejection = describeImageRejection(file, lang);
  if (rejection) throw new Error(rejection);
  const resolvedMime = resolveImageMimeType(file);
  const initialSize = await measure(file);
  const prepared = await compressIfNeeded(file, resolvedMime, initialSize);

  if (prepared.blob.size > MAX_IMAGE_BYTES) {
    const mb = (prepared.blob.size / 1024 / 1024).toFixed(1);
    throw new Error(
      lang === 'en'
        ? `«${file.name || 'file'}» is ${mb} MB and the limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`
        : `«${file.name || 'archivo'}» pesa ${mb} MB y el límite es ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }

  const dataUrl = await readAsDataUrl(prepared.blob);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!base64) {
    throw new Error(
      lang === 'en'
        ? 'Could not read the image on this device.'
        : 'No se pudo leer la imagen en el dispositivo.',
    );
  }
  counter += 1;
  const ext = prepared.mimeType === 'image/png' ? 'png' : prepared.mimeType === 'image/webp' ? 'webp' : 'jpg';
  return {
    id: `img-${Date.now()}-${counter}`,
    name: file.name || `captura-${counter}.${ext}`,
    mimeType: prepared.mimeType,
    size: prepared.blob.size,
    width: prepared.width,
    height: prepared.height,
    previewUrl: URL.createObjectURL(prepared.blob),
    base64,
  };
}

export function releaseImage(image: PreparedImage): void {
  try {
    URL.revokeObjectURL(image.previewUrl);
  } catch {
    // La URL ya pudo revocarse; no hay nada que recuperar.
  }
}

/** Extrae los archivos de imagen de un evento de pegado (Ctrl+V). */
export function imagesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file && (file.type.startsWith('image/') || resolveImageMimeType(file).startsWith('image/'))) {
      files.push(file);
    }
  }
  if (!files.length) {
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.startsWith('image/') || resolveImageMimeType(file).startsWith('image/')) {
        files.push(file);
      }
    }
  }
  return files;
}
