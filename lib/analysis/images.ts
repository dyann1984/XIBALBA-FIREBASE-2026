// Preparación local de imágenes. Todo ocurre en memoria: no hay subida,
// almacenamiento ni copia en disco. El envío al modelo requiere el
// consentimiento explícito que gestiona la interfaz.

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
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

/** Devuelve el motivo del rechazo, o `null` si el archivo es aceptable. */
export function describeImageRejection(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `«${file.name || 'archivo'}» no es JPEG ni PNG. Selecciona una imagen en uno de esos formatos.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `«${file.name || 'archivo'}» pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el límite es ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`;
  }
  if (file.size === 0) return `«${file.name || 'archivo'}» está vacío.`;
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

let counter = 0;

export async function prepareImage(file: File): Promise<PreparedImage> {
  const rejection = describeImageRejection(file);
  if (rejection) throw new Error(rejection);
  const [dataUrl, size] = await Promise.all([readAsDataUrl(file), measure(file)]);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!base64) throw new Error('No se pudo leer la imagen en el dispositivo.');
  counter += 1;
  return {
    id: `img-${Date.now()}-${counter}`,
    name: file.name || `captura-${counter}.${file.type === 'image/png' ? 'png' : 'jpg'}`,
    mimeType: file.type,
    size: file.size,
    width: size.width,
    height: size.height,
    previewUrl: URL.createObjectURL(file),
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
    if (file && file.type.startsWith('image/')) files.push(file);
  }
  if (!files.length) {
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.startsWith('image/')) files.push(file);
    }
  }
  return files;
}
