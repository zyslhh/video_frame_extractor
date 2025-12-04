import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Camera, Play, Pause, SkipBack, SkipForward, Download, MonitorPlay, Layers, Loader2, Globe, ChevronDown } from 'lucide-react';
import { Button } from './components/Button';
import { SettingsPanel } from './components/SettingsPanel';
import { FrameGallery } from './components/FrameGallery';
import { AutoCaptureModal } from './components/AutoCaptureModal';
import { CapturedFrame, ExportSettings } from './types';
import { formatTime, downloadZip } from './utils';
import { translations, Language } from './i18n';
import JSZip from 'jszip';

const App: React.FC = () => {
  // State
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Language State
  const [lang, setLang] = useState<Language>('zh');
  const t = translations[lang];

  // Auto Capture State
  const [isAutoCaptureModalOpen, setIsAutoCaptureModalOpen] = useState(false);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [detectedFps, setDetectedFps] = useState<number | null>(null);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
  const [autoCaptureCount, setAutoCaptureCount] = useState(0);
  
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'image/jpeg',
    quality: 0.9,
    scale: 1,
    prefix: 'image',
    sortOrder: 'asc'
  });

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoCaptureRef = useRef<{ stop: boolean }>({ stop: false });

  // Handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setFrames([]);
      setSettings(prev => ({ ...prev, prefix: 'image' }));
      setCurrentTime(0);
      setDuration(0);
      setAutoCaptureCount(0);
      setDetectedFps(null);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isAutoCapturing && !isAnalyzing) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const seek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0); 
      
      const newFrame: CapturedFrame = {
        id: crypto.randomUUID(),
        timestamp: video.currentTime,
        originalDataUrl: dataUrl,
        width: video.videoWidth,
        height: video.videoHeight
      };

      setFrames(prev => [newFrame, ...prev]);
    }
  }, []);

  // --- FPS Detection ---
  const detectVideoFPS = async (): Promise<number> => {
      const video = videoRef.current;
      if (!video || !('requestVideoFrameCallback' in video)) {
          return 30; // Fallback
      }

      setIsAnalyzing(true);
      const wasPlaying = !video.paused;
      const originalTime = video.currentTime;
      const originalMuted = video.muted;
      
      video.muted = true;
      video.currentTime = 0; 
      
      return new Promise<number>((resolve) => {
          let handle: number;
          let frameCount = 0;
          let lastMediaTime = 0;
          const diffs: number[] = [];
          const maxFrames = 20;

          const callback = (now: number, metadata: VideoFrameCallbackMetadata) => {
              if (frameCount > 0) {
                  const diff = metadata.mediaTime - lastMediaTime;
                  if (diff > 0.001) { 
                      diffs.push(diff);
                  }
              }
              lastMediaTime = metadata.mediaTime;
              frameCount++;

              if (frameCount < maxFrames) {
                  handle = video.requestVideoFrameCallback(callback);
              } else {
                  finish(diffs);
              }
          };

          const finish = (deltas: number[]) => {
            video.pause();
            video.currentTime = originalTime;
            video.muted = originalMuted;
            if (wasPlaying) video.play();
            setIsAnalyzing(false);

            if (deltas.length === 0) {
                resolve(30);
                return;
            }

            deltas.sort((a, b) => a - b);
            const medianDelta = deltas[Math.floor(deltas.length / 2)];
            const fps = medianDelta > 0 ? Math.round(1 / medianDelta) : 30;
            resolve(fps);
          };
          
          video.play().then(() => {
              handle = video.requestVideoFrameCallback(callback);
          }).catch(e => {
              console.warn("Autoplay blocked for analysis", e);
              setIsAnalyzing(false);
              resolve(30);
          });

          setTimeout(() => {
              if (frameCount < maxFrames) {
                  video.cancelVideoFrameCallback(handle);
                  finish(diffs);
              }
          }, 1500);
      });
  };

  const handleOpenBatchModal = async () => {
      if (!videoRef.current) return;
      let fps = detectedFps;
      if (!fps) {
          fps = await detectVideoFPS();
          setDetectedFps(fps);
      }
      setIsAutoCaptureModalOpen(true);
  };

  const startAutoCapture = async (start: number, end: number, interval: number) => {
    const video = videoRef.current;
    if (!video) return;

    setIsAutoCapturing(true);
    setAutoCaptureProgress(0);
    setAutoCaptureCount(0);
    autoCaptureRef.current.stop = false;

    video.pause();
    setIsPlaying(false);

    const seekTo = (time: number): Promise<void> => {
        return new Promise((resolve) => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = time;
        });
    };

    const newFrames: CapturedFrame[] = [];
    let currentTimeLoop = start;
    const totalDuration = end - start;
    let lastDataUrl = '';

    try {
        while (currentTimeLoop <= end) {
            if (autoCaptureRef.current.stop) break;
            await seekTo(currentTimeLoop);
            
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.90); 
                
                if (dataUrl !== lastDataUrl) {
                    newFrames.push({
                        id: crypto.randomUUID(),
                        timestamp: video.currentTime,
                        originalDataUrl: dataUrl,
                        width: video.videoWidth,
                        height: video.videoHeight
                    });
                    lastDataUrl = dataUrl;
                    setAutoCaptureCount(newFrames.length);
                }
            }

            const progress = totalDuration > 0 ? ((currentTimeLoop - start) / totalDuration) * 100 : 100;
            setAutoCaptureProgress(Math.min(99, progress));

            currentTimeLoop += interval;
            await new Promise(r => requestAnimationFrame(r));
        }
        setFrames(prev => [...newFrames.reverse(), ...prev]);
        setAutoCaptureProgress(100);

    } catch (e) {
        console.error("Auto capture error:", e);
    } finally {
        setIsAutoCapturing(false);
        setIsAutoCaptureModalOpen(false);
        video.currentTime = start; 
    }
  };

  const handleDownloadAll = async () => {
    if (frames.length === 0) return;
    setIsProcessing(true);
    try {
      await downloadZip(frames, settings);
    } catch (error) {
      console.error("Failed to zip files", error);
      alert("Error creating ZIP file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const changeSpeed = () => {
    const speeds = [0.25, 0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  return (
    <div className="min-h-screen bg-dark text-slate-200 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <MonitorPlay className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              {t.appTitle}
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Language Dropdown */}
            <div className="relative group mr-1">
                 <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Globe className="h-4 w-4 text-slate-400" />
                 </div>
                 <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Language)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold uppercase rounded-lg block w-[120px] pl-9 pr-8 py-2 cursor-pointer hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none transition-colors"
                 >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                 </select>
                 <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                 </div>
            </div>

            <input 
              type="file" 
              accept="video/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button 
              variant="secondary" 
              icon={<Upload className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
            >
              {t.upload}
            </Button>
            
            <Button 
                variant="secondary"
                disabled={!videoSrc || isAnalyzing}
                icon={isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Layers className="w-4 h-4" />}
                onClick={handleOpenBatchModal}
            >
                {isAnalyzing ? t.analyzing : t.batchExtract}
            </Button>

            <Button 
              variant="primary" 
              disabled={frames.length === 0 || isProcessing || isAnalyzing}
              icon={isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
              onClick={handleDownloadAll}
            >
              {isProcessing ? t.processing : `${t.exportAll} (${frames.length})`}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Player (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 aspect-video group">
            {videoSrc ? (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlay}
                  onEnded={() => setIsPlaying(false)}
                />
                
                {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                        <p className="text-white font-medium">{t.detecting}</p>
                    </div>
                )}
                
                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 transition-opacity duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.01"
                    value={currentTime}
                    onChange={handleSeekChange}
                    disabled={isAutoCapturing || isAnalyzing}
                    className="w-full h-1.5 mb-4 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2 transition-all disabled:opacity-50"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button onClick={() => seek(-1)} disabled={isAutoCapturing || isAnalyzing} className="text-white hover:text-primary transition disabled:opacity-50">
                        <SkipBack className="w-5 h-5" />
                      </button>
                      <button onClick={togglePlay} disabled={isAutoCapturing || isAnalyzing} className="text-white hover:text-primary transition p-2 bg-white/10 rounded-full disabled:opacity-50">
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                      </button>
                      <button onClick={() => seek(1)} disabled={isAutoCapturing || isAnalyzing} className="text-white hover:text-primary transition disabled:opacity-50">
                        <SkipForward className="w-5 h-5" />
                      </button>
                      
                      <div className="text-sm font-mono text-slate-300 space-x-1">
                        <span>{formatTime(currentTime)}</span>
                        <span className="text-slate-500">/</span>
                        <span>{formatTime(duration)}</span>
                        {detectedFps && (
                             <span className="ml-2 px-2 py-0.5 rounded bg-white/10 text-xs text-blue-300 border border-white/10">
                                {detectedFps} FPS
                             </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={changeSpeed} 
                            disabled={isAutoCapturing || isAnalyzing}
                            className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-600 w-12 disabled:opacity-50"
                        >
                            {playbackSpeed}x
                        </button>
                      <Button onClick={captureFrame} disabled={isAutoCapturing || isAnalyzing} size="sm" icon={<Camera className="w-4 h-4"/>}>
                        {t.captureFrame}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:bg-white/5 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">{t.uploadPrompt}</p>
                <p className="text-sm opacity-60">{t.uploadSub}</p>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[300px]">
            <FrameGallery 
              frames={frames} 
              settings={settings}
              onRemove={(id) => setFrames(prev => prev.filter(f => f.id !== id))}
              onClearAll={() => setFrames([])}
              t={t}
            />
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col">
          <SettingsPanel 
            settings={settings} 
            onChange={setSettings} 
            count={frames.length}
            t={t}
          />
          
          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">{t.tipsTitle}</h4>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              <li dangerouslySetInnerHTML={{__html: t.tip1}} />
              <li>{t.tip2}</li>
              <li>{t.tip3}</li>
            </ul>
          </div>
        </div>
      </main>

      <AutoCaptureModal 
        isOpen={isAutoCaptureModalOpen}
        onClose={() => setIsAutoCaptureModalOpen(false)}
        onStart={startAutoCapture}
        duration={duration}
        isProcessing={isAutoCapturing}
        progress={autoCaptureProgress}
        currentCount={autoCaptureCount}
        detectedFps={detectedFps || undefined}
        t={t}
      />
    </div>
  );
};

export default App;