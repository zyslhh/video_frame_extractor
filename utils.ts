import JSZip from 'jszip';
import { CapturedFrame, ExportSettings } from './types';

export const formatTime = (seconds: number): string => {
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  if (hh) {
    return `${hh}:${String(mm).padStart(2, '0')}:${ss}.${ms}`;
  }
  return `${mm}:${ss}.${ms}`;
};

export const generateFilename = (timestamp: number, settings: ExportSettings, index: number): string => {
  const ext = settings.format.split('/')[1];
  // Pads to at least 2 digits (image_01.jpg), but expands if index is 100+
  const padLength = Math.max(2, String(index + 1).length);
  const numStr = String(index + 1).padStart(padLength, '0');
  return `${settings.prefix}_${numStr}.${ext}`;
};

/**
 * Processes a captured frame according to export settings (resize, re-encode).
 */
export const processFrame = async (
  frame: CapturedFrame,
  settings: ExportSettings
): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = frame.originalDataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetWidth = Math.max(1, Math.floor(frame.width * settings.scale));
      const targetHeight = Math.max(1, Math.floor(frame.height * settings.scale));

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // High quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        settings.format,
        settings.quality
      );
    };
  });
};

export const downloadZip = async (frames: CapturedFrame[], settings: ExportSettings) => {
  const zip = new JSZip();
  const folder = zip.folder("extracted_frames");

  if (!folder) return;

  // Sort frames based on settings before naming
  const sortedFrames = [...frames].sort((a, b) => {
    return settings.sortOrder === 'asc' 
      ? a.timestamp - b.timestamp 
      : b.timestamp - a.timestamp;
  });

  const promises = sortedFrames.map(async (frame, index) => {
    const blob = await processFrame(frame, settings);
    if (blob) {
      const filename = generateFilename(frame.timestamp, settings, index);
      folder.file(filename, blob);
    }
  });

  await Promise.all(promises);
  
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${settings.prefix}_frames.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadSingle = async (frame: CapturedFrame, settings: ExportSettings) => {
  const blob = await processFrame(frame, settings);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = generateFilename(frame.timestamp, settings, 0);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};