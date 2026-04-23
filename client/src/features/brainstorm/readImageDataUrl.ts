/** Max image file size for data-URL storage on the brainstorm canvas (MVP). */
export const BRAINSTORM_IMAGE_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

export function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Please drop an image file (PNG, JPEG, GIF, WebP, etc.)."));
  }
  if (file.size > BRAINSTORM_IMAGE_MAX_BYTES) {
    const mb = (BRAINSTORM_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(1);
    return Promise.reject(new Error(`Image is too large (max ${mb}MB).`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}
