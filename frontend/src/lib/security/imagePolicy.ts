export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const IMAGE_LIMITS = {
  originalBytes: 10 * 1024 * 1024,
  base64Characters: Math.ceil((10 * 1024 * 1024) / 3) * 4,
  width: 4096,
  height: 4096,
  contextCharacters: 2_000,
  clipLabelCharacters: 120,
} as const;

export function isAllowedImageMimeType(
  value: string,
): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function validateClientImageMetadata(file: {
  size: number;
  type: string;
}) {
  if (!isAllowedImageMimeType(file.type)) {
    return "Use a JPEG, PNG, or WebP image.";
  }
  if (file.size <= 0) return "The selected image is empty.";
  if (file.size > IMAGE_LIMITS.originalBytes) {
    return "The image must be 10 MB or smaller.";
  }
  return null;
}

export async function validateClientImage(file: File) {
  const metadataError = validateClientImageMetadata(file);
  if (metadataError) return metadataError;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (!width || !height) return "The image dimensions could not be read.";
    if (width > IMAGE_LIMITS.width || height > IMAGE_LIMITS.height) {
      return `The image must be ${IMAGE_LIMITS.width} × ${IMAGE_LIMITS.height} or smaller.`;
    }
    return null;
  } catch {
    return "The selected file is not a readable image.";
  }
}
