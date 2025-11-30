import React from 'react';
import { ExportSettings, ImageFormat } from '../types';
import { Settings, Image, FileType, Scaling, Type, ArrowDownUp } from 'lucide-react';

interface SettingsPanelProps {
  settings: ExportSettings;
  onChange: (settings: ExportSettings) => void;
  count: number;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange, count }) => {
  
  const handleChange = (key: keyof ExportSettings, value: string | number) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-700 p-4 h-full">
      <div className="flex items-center space-x-2 mb-6 border-b border-slate-700 pb-4">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg text-white">Export Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-2">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <FileType className="w-4 h-4 mr-2" />
            Format
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['image/jpeg', 'image/webp', 'image/png'] as ImageFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleChange('format', fmt)}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                  settings.format === fmt
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {fmt.split('/')[1].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="flex items-center text-sm font-medium text-slate-300">
              <Image className="w-4 h-4 mr-2" />
              Quality
            </label>
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
              {Math.round(settings.quality * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={settings.quality}
            onChange={(e) => handleChange('quality', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <p className="text-xs text-slate-500">
            Higher quality increases file size.
          </p>
        </div>

        {/* Scale/Size Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="flex items-center text-sm font-medium text-slate-300">
              <Scaling className="w-4 h-4 mr-2" />
              Resolution Scale
            </label>
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
              {Math.round(settings.scale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={settings.scale}
            onChange={(e) => handleChange('scale', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <p className="text-xs text-slate-500">
            Resize output images relative to original video.
          </p>
        </div>

        {/* Sort Order */}
        <div className="space-y-2">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <ArrowDownUp className="w-4 h-4 mr-2" />
            Export Order
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
             <button
                onClick={() => handleChange('sortOrder', 'asc')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  settings.sortOrder === 'asc'
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Ascending (Oldest First)
              </button>
              <button
                onClick={() => handleChange('sortOrder', 'desc')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  settings.sortOrder === 'desc'
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Descending (Newest First)
              </button>
          </div>
        </div>

        {/* Filename Prefix */}
        <div className="space-y-2">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <Type className="w-4 h-4 mr-2" />
            Filename Prefix
          </label>
          <input
            type="text"
            value={settings.prefix}
            onChange={(e) => handleChange('prefix', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="frame"
          />
          <p className="text-xs text-slate-500">
            Example output: {settings.prefix}_01.{settings.format.split('/')[1]}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-700">
            <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400 flex justify-between">
                    <span>Selected Frames:</span>
                    <span className="text-white font-semibold">{count}</span>
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};