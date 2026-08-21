const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1200;
const MAX_IMAGE_UPLOAD_SIZE = 600_000;

/** Prepara una imagen en el navegador para que el formulario sea liviano y estable en producción. */
export async function prepareImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Elegí un archivo de imagen.");
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    throw new Error("La imagen debe pesar menos de 10 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo leer la imagen."));
      image.src = objectUrl;
    });

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    let quality = 0.84;
    let result = await canvasToBlob(canvas, "image/webp", quality);
    let outputType = "image/webp";
    if (result.type !== "image/webp") {
      result = await canvasToBlob(canvas, "image/jpeg", quality);
      outputType = "image/jpeg";
    }
    while (result.size > MAX_IMAGE_UPLOAD_SIZE && quality > 0.5) {
      quality -= 0.08;
      result = await canvasToBlob(canvas, outputType, quality);
    }
    if (result.size > MAX_IMAGE_UPLOAD_SIZE) {
      throw new Error("La imagen sigue siendo demasiado pesada. Elegí otra más chica.");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([result], `${baseName}.${outputType === "image/webp" ? "webp" : "jpg"}`, {
      type: outputType,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo preparar la imagen."));
    }, type, quality);
  });
}
