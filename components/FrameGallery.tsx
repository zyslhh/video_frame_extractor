import React from 'react';
import { CapturedFrame, ExportSettings } from '../types';
import { formatTime, downloadSingle } from '../utils';
import { Download, Trash2, Maximize2 } from 'lucide-react';
import { Button } from './Button';
import { translations } from '../i18n';

interface FrameGalleryProps {
  frames: CapturedFrame[];
  settings: ExportSettings;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  t: typeof translations.en;
}

export const FrameGallery: React.FC<FrameGalleryProps> = ({ 
  frames, 
  settings, 
  onRemove,
  onClearAll,
  t
}) => {
  if (frames.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-surface/30">
        <Maximize2 className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t.emptyGallery}</p>
        <p className="text-sm">{t.emptyGalleryHelp}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-semibold text-white">{t.galleryTitle} ({frames.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClearAll} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
          {t.clearAll}
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {frames.map((frame) => (
            <div key={frame.id} className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 hover:border-primary transition-colors">
              <img 
                src={frame.originalDataUrl} 
                alt={`Frame at ${frame.timestamp}`}
                className="w-full h-full object-contain"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => downloadSingle(frame, settings)}
                    className="p-2 bg-primary text-white rounded-full hover:bg-blue-600 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onRemove(frame.id)}
                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Timestamp Badge */}
              <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs text-white font-mono">
                {formatTime(frame.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};