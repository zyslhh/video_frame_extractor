import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, Zap, Film } from 'lucide-react';
import { Button } from './Button';
import { formatTime } from '../utils';

interface AutoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (start: number, end: number, interval: number) => void;
  duration: number;
  isProcessing: boolean;
  progress: number;
}

export const AutoCaptureModal: React.FC<AutoCaptureModalProps> = ({
  isOpen,
  onClose,
  onStart,
  duration,
  isProcessing,
  progress
}) => {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [interval, setInterval] = useState(1);
  const [fps, setFps] = useState(1);
  const [mode, setMode] = useState<'interval' | 'fps'>('interval');

  // Update end time when duration loads/changes
  useEffect(() => {
    if (isOpen && duration > 0 && endTime === 0) {
        setEndTime(duration);
    }
  }, [isOpen, duration]);

  // Sync FPS and Interval
  const handleIntervalChange = (val: number) => {
      setInterval(val);
      if (val > 0) setFps(Number((1 / val).toFixed(2)));
  };

  const handleFpsChange = (val: number) => {
      setFps(val);
      if (val > 0) setInterval(Number((1 / val).toFixed(4)));
  };

  const setPresetAllFrames = () => {
      setStartTime(0);
      setEndTime(duration);
      handleFpsChange(30); // Default to 30 FPS for "All Frames"
      setMode('fps');
  };

  if (!isOpen) return null;

  const estimatedFrames = interval > 0 ? Math.floor((endTime - startTime) / interval) + 1 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Batch Extraction
                </h3>
                {!isProcessing && (
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
                {isProcessing ? (
                    <div className="text-center space-y-6 py-4">
                        <div className="relative w-32 h-32 mx-auto">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle 
                                    className="text-slate-800 stroke-current" 
                                    strokeWidth="8" 
                                    cx="50" 
                                    cy="50" 
                                    r="40" 
                                    fill="transparent"
                                ></circle>
                                <circle 
                                    className="text-primary stroke-current transition-all duration-300 ease-out" 
                                    strokeWidth="8" 
                                    strokeLinecap="round" 
                                    cx="50" 
                                    cy="50" 
                                    r="40" 
                                    fill="transparent" 
                                    strokeDasharray="251.2" 
                                    strokeDashoffset={251.2 - (251.2 * progress) / 100} 
                                ></circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-white font-medium text-lg">Extracting Frames...</p>
                            <p className="text-sm text-slate-400 mt-1">Please do not close this window or the browser.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Presets */}
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={setPresetAllFrames}
                                className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-200 rounded-xl transition-all text-sm font-medium"
                            >
                                <Film className="w-4 h-4" />
                                Extract All (30fps)
                            </button>
                            <button 
                                onClick={() => { handleIntervalChange(1); setStartTime(0); setEndTime(duration); setMode('interval'); }}
                                className="flex items-center justify-center gap-2 p-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl transition-all text-sm font-medium"
                            >
                                <Zap className="w-4 h-4" />
                                Every Second
                            </button>
                        </div>

                         <div className="space-y-5 border-t border-slate-700/50 pt-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Start Time</label>
                                    <input 
                                        type="number" 
                                        min={0} 
                                        max={endTime} 
                                        step={0.1}
                                        value={startTime} 
                                        onChange={(e) => setStartTime(Math.max(0, Number(e.target.value)))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                    />
                                    <p className="text-xs text-slate-500 font-mono text-right">{formatTime(startTime)}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">End Time</label>
                                    <input 
                                        type="number" 
                                        min={startTime} 
                                        max={duration} 
                                        step={0.1}
                                        value={endTime} 
                                        onChange={(e) => setEndTime(Math.min(duration, Number(e.target.value)))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                    />
                                    <p className="text-xs text-slate-500 font-mono text-right">{formatTime(endTime)}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex gap-4 mb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="mode" 
                                            checked={mode === 'interval'} 
                                            onChange={() => setMode('interval')}
                                            className="text-primary focus:ring-primary bg-slate-900 border-slate-700"
                                        />
                                        <span className={`text-xs font-semibold uppercase tracking-wider ${mode === 'interval' ? 'text-primary' : 'text-slate-400'}`}>By Interval (sec)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="mode" 
                                            checked={mode === 'fps'} 
                                            onChange={() => setMode('fps')}
                                            className="text-primary focus:ring-primary bg-slate-900 border-slate-700"
                                        />
                                        <span className={`text-xs font-semibold uppercase tracking-wider ${mode === 'fps' ? 'text-primary' : 'text-slate-400'}`}>By FPS</span>
                                    </label>
                                </div>
                                
                                {mode === 'interval' ? (
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min={0.01} 
                                            step={0.1}
                                            value={interval} 
                                            onChange={(e) => handleIntervalChange(Math.max(0.01, Number(e.target.value)))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                        />
                                        <div className="absolute right-3 top-2.5 text-xs text-slate-500">sec</div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min={1}
                                            max={60}
                                            step={1}
                                            value={fps} 
                                            onChange={(e) => handleFpsChange(Math.max(0.1, Number(e.target.value)))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                        />
                                        <div className="absolute right-3 top-2.5 text-xs text-slate-500">fps</div>
                                    </div>
                                )}
                                <p className="text-xs text-slate-500">
                                    {mode === 'interval' ? `Capture one frame every ${interval} seconds.` : `Capture ${fps} frames per second.`}
                                </p>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-200">
                                    <p className="font-semibold mb-1">Estimate</p>
                                    <p>This will capture approximately <span className="text-white font-bold">{estimatedFrames}</span> frames.</p>
                                    <p className="text-xs text-blue-300/60 mt-1">Duplicates are automatically skipped.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button 
                                variant="primary" 
                                onClick={() => onStart(startTime, endTime, interval)}
                                icon={<Play className="w-4 h-4" />}
                                disabled={estimatedFrames <= 0}
                            >
                                Start Extraction
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    </div>
  );
};