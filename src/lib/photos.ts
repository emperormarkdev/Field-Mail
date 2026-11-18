import { newId } from './id';
import type { StoredPhoto } from '../types';

const MAX_EDGE = 1280;
const QUALITY = 0.7;
const THUMB_EDGE = 320;
const THUMB_QUALITY = 0.6;

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  // createImageBitmap applies EXIF orientation, so portrait phone shots land upright.
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path (some Safari versions reject the options bag).
    }
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('That image could not be opened.'));
    img.src = url;
  });
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawTo(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process that photo.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // White matte so transparent PNGs don't turn black once flattened to JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('That photo could not be compressed.'))),
      'image/jpeg',
      quality,
    );
  });
}

export interface CompressedPhoto {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.');
  }

  const decoded = await decode(file);
  try {
    const main = fit(decoded.width, decoded.height, MAX_EDGE);
    const canvas = drawTo(decoded.source, main.width, main.height);
    const thumbSize = fit(main.width, main.height, THUMB_EDGE);
    const thumbCanvas = drawTo(canvas, thumbSize.width, thumbSize.height);

    const [blob, thumb] = await Promise.all([
      toBlob(canvas, QUALITY),
      toBlob(thumbCanvas, THUMB_QUALITY),
    ]);

    return { blob, thumb, width: main.width, height: main.height };
  } finally {
    decoded.release();
  }
}

export async function createStoredPhoto(params: {
  file: File;
  reportId: string;
  fieldId: string;
}): Promise<StoredPhoto> {
  const compressed = await compressPhoto(params.file);
  return {
    id: newId(),
    reportId: params.reportId,
    fieldId: params.fieldId,
    blob: compressed.blob,
    thumb: compressed.thumb,
    caption: '',
    width: compressed.width,
    height: compressed.height,
    createdAt: Date.now(),
  };
}

const urlCache = new WeakMap<Blob, string>();

/** Stable object URL per blob so React re-renders don't leak or flicker. */
export function blobUrl(blob: Blob): string {
  const cached = urlCache.get(blob);
  if (cached) return cached;
  const url = URL.createObjectURL(blob);
  urlCache.set(blob, url);
  return url;
}

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That photo could not be read.'));
    reader.readAsDataURL(blob);
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return base64FromBuffer(buffer);
}

export function base64FromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
