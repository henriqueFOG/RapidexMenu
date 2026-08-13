import { HttpError } from "./http";

export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

const MAX_DIMENSION = 6000;
const MAX_PIXELS = 25_000_000;

export function validateImageBytes(bytes: ArrayBuffer, declaredType: string) {
  const view = new Uint8Array(bytes);
  const detected = detectImageType(view);
  if (!detected) {
    throw new HttpError(415, "O arquivo não contém uma imagem JPG, PNG ou WebP válida.", "unsupported_media");
  }
  if (declaredType !== detected.mime) {
    throw new HttpError(415, "O tipo real da imagem não corresponde ao arquivo enviado.", "media_type_mismatch", {
      declaredType,
      detectedType: detected.mime,
    });
  }
  const dimensions = readDimensions(view, detected.mime);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw new HttpError(415, "Não foi possível validar as dimensões da imagem.", "invalid_image_dimensions");
  }
  if (
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION ||
    dimensions.width * dimensions.height > MAX_PIXELS
  ) {
    throw new HttpError(
      413,
      `Imagem grande demais. Use no máximo ${MAX_DIMENSION}×${MAX_DIMENSION}px e ${Math.floor(MAX_PIXELS / 1_000_000)} megapixels.`,
      "image_dimensions_too_large",
      dimensions,
    );
  }
  return { ...detected, ...dimensions };
}

function detectImageType(bytes: Uint8Array): { mime: SupportedImageMime; extension: "jpg" | "png" | "webp" } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

function readDimensions(bytes: Uint8Array, mime: SupportedImageMime) {
  if (mime === "image/png") return readPngDimensions(bytes);
  if (mime === "image/jpeg") return readJpegDimensions(bytes);
  return readWebpDimensions(bytes);
}

function readPngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || ascii(bytes, 12, 16) !== "IHDR") return null;
  return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function readJpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 1 >= bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (isJpegSof(marker) && length >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }
    offset += length;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + u24le(bytes, 24),
      height: 1 + u24le(bytes, 27),
    };
  }
  if (chunk === "VP8 ") {
    const data = 20;
    if (bytes.length < data + 10 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) return null;
    return {
      width: ((bytes[data + 7] << 8) | bytes[data + 6]) & 0x3fff,
      height: ((bytes[data + 9] << 8) | bytes[data + 8]) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const data = 20;
    if (bytes.length < data + 5 || bytes[data] !== 0x2f) return null;
    const bits = bytes[data + 1] | (bytes[data + 2] << 8) | (bytes[data + 3] << 16) | (bytes[data + 4] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

function isJpegSof(marker: number) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}
function u32be(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}
function u24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
