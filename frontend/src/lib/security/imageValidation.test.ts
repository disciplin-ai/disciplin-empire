import assert from "node:assert/strict";
import test from "node:test";
import {
  ImageValidationError,
  validateBase64Image,
} from "./imageValidation";

function pngHeader(width: number, height: number) {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes.toString("base64");
}

test("accepts an allowed image whose signature and dimensions agree", () => {
  const image = validateBase64Image(pngHeader(1280, 720), "image/png");
  assert.equal(image.mimeType, "image/png");
  assert.equal(image.width, 1280);
  assert.equal(image.height, 720);
});

test("rejects malformed Base64 before image processing", () => {
  assert.throws(
    () => validateBase64Image("not-valid!!", "image/png"),
    (error: unknown) =>
      error instanceof ImageValidationError && error.status === 400,
  );
});

test("rejects a spoofed MIME type", () => {
  assert.throws(
    () => validateBase64Image(pngHeader(10, 10), "image/jpeg"),
    (error: unknown) =>
      error instanceof ImageValidationError && error.status === 415,
  );
});

test("rejects excessive decoded dimensions", () => {
  assert.throws(
    () => validateBase64Image(pngHeader(4097, 720), "image/png"),
    (error: unknown) =>
      error instanceof ImageValidationError && error.status === 413,
  );
});
