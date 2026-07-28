import {
  IMAGE_LIMITS,
  isAllowedImageMimeType,
  type AllowedImageMimeType,
} from "./imagePolicy";

export type ValidatedImage = {
  buffer: Buffer;
  mimeType: AllowedImageMimeType;
  width: number;
  height: number;
  base64: string;
};

export class ImageValidationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "ImageValidationError";
  }
}

function detectedMimeType(buffer: Buffer): AllowedImageMimeType | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function pngDimensions(buffer: Buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegDimensions(buffer: Buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb,
        0xcd, 0xce, 0xcf,
      ].includes(marker)
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(buffer: Buffer) {
  if (buffer.length < 30) return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8L" && buffer[20] === 0x2f) {
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
    };
  }
  if (
    chunk === "VP8 " &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  return null;
}

function dimensions(buffer: Buffer, mimeType: AllowedImageMimeType) {
  if (mimeType === "image/png") return pngDimensions(buffer);
  if (mimeType === "image/jpeg") return jpegDimensions(buffer);
  return webpDimensions(buffer);
}

function normalizeBase64(input: string) {
  const value = input.trim();
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma >= 0 ? value.slice(comma + 1) : value;
}

export function validateBase64Image(
  input: string,
  declaredMimeType: string,
): ValidatedImage {
  if (!isAllowedImageMimeType(declaredMimeType)) {
    throw new ImageValidationError(
      "Unsupported image type. Use JPEG, PNG, or WebP.",
      415,
    );
  }

  const base64 = normalizeBase64(input);
  if (!base64) throw new ImageValidationError("Missing image payload.", 400);
  if (base64.length > IMAGE_LIMITS.base64Characters) {
    throw new ImageValidationError("Image payload exceeds the 10 MB limit.", 413);
  }
  if (
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new ImageValidationError("Malformed Base64 image payload.", 400);
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    throw new ImageValidationError("Malformed Base64 image payload.", 400);
  }
  if (buffer.length > IMAGE_LIMITS.originalBytes) {
    throw new ImageValidationError("Image exceeds the 10 MB limit.", 413);
  }

  const actualMimeType = detectedMimeType(buffer);
  if (!actualMimeType) {
    throw new ImageValidationError("The payload is not a supported image.", 415);
  }
  if (actualMimeType !== declaredMimeType) {
    throw new ImageValidationError(
      "The declared image type does not match its content.",
      415,
    );
  }

  const size = dimensions(buffer, actualMimeType);
  if (!size?.width || !size.height) {
    throw new ImageValidationError("Image dimensions could not be read.", 400);
  }
  if (size.width > IMAGE_LIMITS.width || size.height > IMAGE_LIMITS.height) {
    throw new ImageValidationError(
      `Image dimensions exceed ${IMAGE_LIMITS.width} × ${IMAGE_LIMITS.height}.`,
      413,
    );
  }

  return {
    buffer,
    mimeType: actualMimeType,
    width: size.width,
    height: size.height,
    base64,
  };
}

export async function validateImageFile(file: File) {
  if (file.size > IMAGE_LIMITS.originalBytes) {
    throw new ImageValidationError("Image exceeds the 10 MB limit.", 413);
  }
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return validateBase64Image(base64, file.type);
}
