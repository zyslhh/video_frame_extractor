import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Camera, Play, Pause, SkipBack, SkipForward, Download, MonitorPlay, Layers } from 'lucide-react';
import { Button } from './components/Button';
import { SettingsPanel } from './components/SettingsPanel';
import { FrameGallery } from './components/FrameGallery';
import { AutoCaptureModal } from './components/AutoCaptureModal';
import { CapturedFrame, ExportSettings } from './types';
import { formatTime, downloadZip } from './utils';
import JSZip from 'jszip'; // Ensure jszip is installed or available in environment

const App: React.FC = () => {
  // State
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Auto Capture State
  const [isAutoCaptureModalOpen, setIsAutoCaptureModalOpen] = useState(false);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
  
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
      // Default to "image" prefix as per request, or use filename. Using generic 'image' or file name is optional.
      // prompt said "image_01.jpg", so defaulting prefix to 'image' is safer, but filename is more useful.
      // Let's stick to the prompt's implied default of 'image' if the user doesn't change it, 
      // but usually file name is better. I'll update the initial state above to 'image' and 
      // here I will NOT overwrite it with filename to strictly follow the "image_01" request vibe,
      // or I can set it to 'image'. Let's set it to 'image'.
      setSettings(prev => ({ ...prev, prefix: 'image' }));
      
      // Reset timestamps
      setCurrentTime(0);
      setDuration(0);
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
    // Only update state if we are NOT auto capturing to avoid UI jitter/performance issues during batch process
    if (videoRef.current && !isAutoCapturing) {
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
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0); // Store high quality initially
      
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

  // --- Auto Capture Logic ---
  const startAutoCapture = async (start: number, end: number, interval: number) => {
    const video = videoRef.current;
    if (!video) return;

    setIsAutoCapturing(true);
    setAutoCaptureProgress(0);
    autoCaptureRef.current.stop = false;

    // Pause video and ensure we are in a clean state
    video.pause();
    setIsPlaying(false);

    // Helper to wait for seek
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
            
            // Capture Logic
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95); 
                
                // Duplicate Check
                if (dataUrl !== lastDataUrl) {
                    newFrames.push({
                        id: crypto.randomUUID(),
                        timestamp: video.currentTime,
                        originalDataUrl: dataUrl,
                        width: video.videoWidth,
                        height: video.videoHeight
                    });
                    lastDataUrl = dataUrl;
                }
            }

            // Update Progress
            const progress = totalDuration > 0 ? ((currentTimeLoop - start) / totalDuration) * 100 : 100;
            setAutoCaptureProgress(Math.min(99, progress));

            currentTimeLoop += interval;
            
            // Small yield to let UI update
            await new Promise(r => setTimeout(r, 10));
        }
        
        // Add all at once
        setFrames(prev => [...newFrames.reverse(), ...prev]);
        setAutoCaptureProgress(100);

    } catch (e) {
        console.error("Auto capture error:", e);
    } finally {
        setIsAutoCapturing(false);
        setIsAutoCaptureModalOpen(false);
        // Reset player to start
        video.currentTime = start; 
    }
  };

  const stopAutoCapture = () => {
      autoCaptureRef.current.stop = true;
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

  // Cleanup object URL
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
              FrameCraft Pro
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
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
            >
              Upload
            </Button>
            
            {/* Batch Extract Button */}
            <Button 
                variant="secondary"
                disabled={!videoSrc}
                icon={<Layers className="w-4 h-4" />}
                onClick={() => setIsAutoCaptureModalOpen(true)}
            >
                Batch Extract
            </Button>

            <Button 
              variant="primary" 
              disabled={frames.length === 0 || isProcessing}
              icon={isProcessing ? undefined : <Download className="w-4 h-4" />}
              onClick={handleDownloadAll}
            >
              {isProcessing ? 'Processing...' : `Export All (${frames.length})`}
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
                
                {/* Custom Controls Overlay */}
                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 transition-opacity duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                  {/* Progress Bar */}
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.01"
                    value={currentTime}
                    onChange={handleSeekChange}
                    disabled={isAutoCapturing}
                    className="w-full h-1.5 mb-4 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2 transition-all disabled:opacity-50"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button onClick={() => seek(-1)} disabled={isAutoCapturing} className="text-white hover:text-primary transition disabled:opacity-50">
                        <SkipBack className="w-5 h-5" />
                      </button>
                      <button onClick={togglePlay} disabled={isAutoCapturing} className="text-white hover:text-primary transition p-2 bg-white/10 rounded-full disabled:opacity-50">
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                      </button>
                      <button onClick={() => seek(1)} disabled={isAutoCapturing} className="text-white hover:text-primary transition disabled:opacity-50">
                        <SkipForward className="w-5 h-5" />
                      </button>
                      
                      <div className="text-sm font-mono text-slate-300 space-x-1">
                        <span>{formatTime(currentTime)}</span>
                        <span className="text-slate-500">/</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={changeSpeed} 
                            disabled={isAutoCapturing}
                            className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded border border-slate-600 w-12 disabled:opacity-50"
                        >
                            {playbackSpeed}x
                        </button>
                      <Button onClick={captureFrame} disabled={isAutoCapturing} size="sm" icon={<Camera className="w-4 h-4"/>}>
                        Capture Frame
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
                <p className="text-lg font-medium">Click to upload or drag video here</p>
                <p className="text-sm opacity-60">Supports MP4, WebM, MOV</p>
              </div>
            )}
          </div>

          {/* Gallery Section - Below Player on Large Screens */}
          <div className="flex-1 min-h-[300px]">
            <FrameGallery 
              frames={frames} 
              settings={settings}
              onRemove={(id) => setFrames(prev => prev.filter(f => f.id !== id))}
              onClearAll={() => setFrames([])}
            />
          </div>
        </div>

        {/* Right Column: Settings (4 cols) */}
        <div className="lg:col-span-4 flex flex-col">
          <SettingsPanel 
            settings={settings} 
            onChange={setSettings} 
            count={frames.length}
          />
          
          {/* Instructions / Info */}
          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Pro Tips:</h4>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
              <li>Use <strong>Batch Extract</strong> to automatically capture frames.</li>
              <li>The <strong>Export All</strong> preset tries to capture every frame (30fps) while skipping duplicates.</li>
              <li>Adjust "Resolution Scale" to reduce file size before export.</li>
              <li>WebP format offers better compression than JPEG.</li>
            </ul>
          </div>
        </div>

      </main>

      {/* Modals */}
      <AutoCaptureModal 
        isOpen={isAutoCaptureModalOpen}
        onClose={() => setIsAutoCaptureModalOpen(false)}
        onStart={startAutoCapture}
        duration={duration}
        isProcessing={isAutoCapturing}
        progress={autoCaptureProgress}
      />
    </div>
  );
};

export default App;