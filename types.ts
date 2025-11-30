export type ImageFormat = 'image/jpeg' | 'image/webp' | 'image/png';

export interface ExportSettings {
  format: ImageFormat;
  quality: number; // 0.1 to 1.0
  scale: number; // 0.1 to 1.0 (Resize factor)
  prefix: string;
  sortOrder: 'asc' | 'desc';
}

export interface CapturedFrame {
  id: string;
  timestamp: number;
  originalDataUrl: string; // The raw capture at 100% scale
  width: number;
  height: number;
}