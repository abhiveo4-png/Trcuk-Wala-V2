import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  CloudRain,
  CloudOff,
  Keyboard,
  Sparkles,
  Zap,
  Coffee,
  Navigation,
  Headphones,
  MapPin,
  Sun,
  Moon,
  Snowflake
} from 'lucide-react';
import { PLAYLIST_TRACKS } from './data/songsAndShayari';
import { Track } from './types';
import { RainCanvas } from './components/RainCanvas';
import { ShayariRotator } from './components/ShayariRotator';
import { MusicPlayer } from './components/MusicPlayer';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { YouTubeVideoModal } from './components/YouTubeVideoModal';
import { YouTubeAudioPlayer } from './components/YouTubeAudioPlayer';
import { YouTubeHornPlayer } from './components/YouTubeHornPlayer';

// Background image generated via Gemini skill
import truckBgImg from './assets/images/indian_truck_highway_1786452697817.jpg';

export default function App() {
  // Real-time Clock
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).toLowerCase()
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Rain & Wipers State
  const [isRainActive, setIsRainActive] = useState<boolean>(true);
  const [rainIntensity, setRainIntensity] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [isWiperActive, setIsWiperActive] = useState<boolean>(false);
  const [isEarphoneMode, setIsEarphoneMode] = useState<boolean>(false);

  // Background Environment Mode State ('night' | 'day' | 'winter')
  const [bgMode, setBgMode] = useState<'night' | 'day' | 'winter'>('night');

  const cycleBgMode = () => {
    setBgMode((prev) => {
      if (prev === 'night') return 'day';
      if (prev === 'day') return 'winter';
      return 'night';
    });
  };

  const triggerWiper = () => {
    setIsWiperActive(true);
    setTimeout(() => setIsWiperActive(false), 2400);
  };

  const cycleRain = () => {
    if (!isRainActive) {
      setIsRainActive(true);
      setRainIntensity('light');
    } else if (rainIntensity === 'light') {
      setRainIntensity('medium');
    } else if (rainIntensity === 'medium') {
      setRainIntensity('heavy');
    } else {
      setIsRainActive(false);
    }
  };

  // Horn Trigger State
  const HORN_SOUNDS = [
    { id: 'Ou90h8AbIoQ', name: 'Basuri Horn 1', label: 'Horn 1' },
    { id: 'o7To79JxP6Y', name: 'Basuri Horn 2', label: 'Horn 2' }
  ];

  const [currentHornIdx, setCurrentHornIdx] = useState<number>(0);
  const [youtubeHornSignal, setYoutubeHornSignal] = useState<number>(0);
  const [isHornActive, setIsHornActive] = useState<boolean>(false);
  const [activeHornName, setActiveHornName] = useState<string>('');

  const playHornSound = (index?: number) => {
    const targetIdx = typeof index === 'number' ? index : currentHornIdx;
    const safeIdx = (targetIdx >= 0 && targetIdx < HORN_SOUNDS.length) ? targetIdx : 0;
    setCurrentHornIdx(safeIdx);
    if (HORN_SOUNDS[safeIdx]) {
      setActiveHornName(HORN_SOUNDS[safeIdx].name);
    }
    setYoutubeHornSignal((prev) => prev + 1);
  };

  const playNextHornSound = () => {
    setCurrentHornIdx((prevIdx) => {
      const nextIdx = (prevIdx + 1) % HORN_SOUNDS.length;
      setActiveHornName(HORN_SOUNDS[nextIdx].name);
      setYoutubeHornSignal((prev) => prev + 1);
      return nextIdx;
    });
  };

  // Music Player State
  const [playlistTracks] = useState<Track[]>(PLAYLIST_TRACKS);
  const [activeCustomTrack, setActiveCustomTrack] = useState<Track | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(PLAYLIST_TRACKS[0].durationSeconds);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  // Modals
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);

  const currentTrack = activeCustomTrack || playlistTracks[currentTrackIndex] || PLAYLIST_TRACKS[0];

  // Update track duration when track changes
  useEffect(() => {
    if (currentTrack) {
      setDuration(currentTrack.durationSeconds || 210);
      setCurrentTime(0);
    }
  }, [currentTrack]);

  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleNextTrack = () => {
    if (activeCustomTrack) {
      setActiveCustomTrack(null);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % playlistTracks.length);
    }
  };

  const handlePrevTrack = () => {
    if (activeCustomTrack) {
      setActiveCustomTrack(null);
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + playlistTracks.length) % playlistTracks.length);
    }
  };

  const handleSelectTrack = (selectedTrack: Track) => {
    const existingIndex = playlistTracks.findIndex((t) => t.youtubeId === selectedTrack.youtubeId);
    if (existingIndex !== -1) {
      setActiveCustomTrack(null);
      setCurrentTrackIndex(existingIndex);
    } else {
      // Play directly without adding to the fixed playlist array
      setActiveCustomTrack(selectedTrack);
    }
    setIsPlaying(true);
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    setSeekTime(seconds);
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 'h') {
        e.preventDefault();
        playNextHornSound();
      } else if (key === ' ' || key === 'k') {
        e.preventDefault();
        handlePlayPause();
      } else if (key === 'arrowright') {
        e.preventDefault();
        handleNextTrack();
      } else if (key === 'arrowleft') {
        e.preventDefault();
        handlePrevTrack();
      } else if (key === 'w') {
        e.preventDefault();
        triggerWiper();
      } else if (key === 'r') {
        e.preventDefault();
        cycleRain();
      } else if (key === 'e') {
        e.preventDefault();
        setIsEarphoneMode((prev) => !prev);
      } else if (key === 'm') {
        e.preventDefault();
        handleToggleMute();
      } else if (key === 'b') {
        e.preventDefault();
        cycleBgMode();
      } else if (key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rainIntensity]);

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden overflow-y-auto select-none pb-28 sm:pb-32">
      {/* Rain Canvas System */}
      <RainCanvas
        isRainActive={isRainActive}
        rainIntensity={rainIntensity}
        isWiperActive={isWiperActive}
        isEarphoneMode={isEarphoneMode}
      />

      {/* Atmospheric Highway Background */}
      <div className="fixed inset-0 z-0 pointer-events-none transition-all duration-1000 overflow-hidden">
        {/* Same Base Generated Image Background */}
        <img
          src={truckBgImg}
          alt="Indian Truck on Highway"
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover object-center scale-105 transition-all duration-1000 ease-in-out ${
            bgMode === 'day'
              ? 'brightness-110 contrast-115 saturate-135 sepia-[0.08]'
              : bgMode === 'winter'
              ? 'brightness-95 contrast-95 saturate-70 hue-rotate-15'
              : 'brightness-90 contrast-105 saturate-100'
          }`}
        />

        {/* Night Mode Overlays (Deep Midnight Top -> Warm Crimson Bottom) */}
        {bgMode === 'night' && (
          <div className="transition-all duration-1000">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/85 via-slate-950/40 to-[#8B0000]/80 mix-blend-multiply" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/30 to-black/85" />
          </div>
        )}

        {/* Day Mode Overlays (Warm Sunny Daylight Highway) */}
        {bgMode === 'day' && (
          <div className="transition-all duration-1000">
            <div className="absolute inset-0 bg-gradient-to-b from-sky-400/35 via-amber-200/15 to-slate-950/70 mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-amber-500/25 to-sky-300/15" />
            <div className="absolute inset-0 bg-radial from-amber-200/20 via-transparent to-black/50" />
            <div className="absolute -top-12 right-1/4 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
          </div>
        )}

        {/* Winter Mode Overlays (Cool Icy Fog & Misty Winter Highway) */}
        {bgMode === 'winter' && (
          <div className="transition-all duration-1000">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/60 via-slate-900/50 to-slate-950/85 mix-blend-color-dodge" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-cyan-950/50 to-cyan-800/20" />
            <div className="absolute inset-0 bg-radial from-cyan-200/15 via-transparent to-slate-950/85" />
            <div className="absolute inset-0 bg-cyan-950/20 backdrop-blur-[0.5px]" />
          </div>
        )}
      </div>

      {/* Top Header Navigation Bar */}
      <header className="relative z-30 w-full px-3 sm:px-6 py-3 sm:py-5 flex flex-col md:flex-row items-center justify-between gap-3 font-sans">
        {/* Top Row on Mobile: Left (Clock & Milestone) + Right (Live Status) */}
        <div className="w-full md:w-auto flex items-center justify-between gap-3">
          {/* Left: Clock & Milestone */}
          <div className="flex flex-col items-start gap-0.5 text-sm md:text-base font-semibold tracking-wider text-slate-200">
            <span className="font-mono text-amber-200/90">{timeString || '5:46 pm'}</span>
            <div className="glass-pill px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1 shadow-sm bg-black/50">
              <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
              <span>319 Km - Gorakhpur</span>
            </div>
          </div>

          {/* Center / Right: Highway Live Status Pill */}
          <div className="glass-pill px-3 sm:px-4 py-1 sm:py-1.5 rounded-full flex items-center gap-2 shadow-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-100 tracking-wide font-mono">
              648 <span className="text-slate-300 font-normal">on the highway</span>
            </span>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="w-full md:w-auto flex items-center justify-start sm:justify-center md:justify-end gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {/* Background Environment Mode Toggle (Day / Night / Winter) */}
          <button
            onClick={cycleBgMode}
            title={`Background Environment: ${bgMode.toUpperCase()} (Click to change: Night -> Day -> Winter, Key: B)`}
            className={`glass-pill px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
              bgMode === 'day'
                ? "bg-amber-500/30 text-amber-200 border-amber-400/50 shadow-lg shadow-amber-950/50 ring-1 ring-amber-400/40"
                : bgMode === 'winter'
                ? "bg-cyan-500/30 text-cyan-200 border-cyan-400/50 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400/40"
                : "bg-indigo-500/30 text-indigo-200 border-indigo-400/50 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-400/40"
            }`}
          >
            {bgMode === 'day' && (
              <>
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 animate-spin-slow" />
                <span>Day ☀️</span>
              </>
            )}
            {bgMode === 'night' && (
              <>
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-300" />
                <span>Night 🌙</span>
              </>
            )}
            {bgMode === 'winter' && (
              <>
                <Snowflake className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 animate-pulse" />
                <span>Winter ❄️</span>
              </>
            )}
          </button>
          {/* Unified Rain Control Button (OFF -> Light -> Medium -> Heavy) */}
          <button
            onClick={cycleRain}
            title={
              isRainActive
                ? `Rain: ${rainIntensity.charAt(0).toUpperCase() + rainIntensity.slice(1)} (Click to change intensity / stop, Key: R)`
                : "Start Rain (Key: R)"
            }
            className={`glass-pill px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isRainActive
                ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/40 shadow-lg shadow-cyan-950/50"
                : "text-slate-300 hover:text-white hover:bg-white/15"
            }`}
          >
            {isRainActive ? (
              <>
                <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 animate-pulse" />
                <span>
                  Rain: <span className="capitalize font-mono font-semibold text-cyan-200">{rainIntensity}</span>
                </span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                <span>Rain: OFF</span>
              </>
            )}
          </button>

          {/* Earphone Mode Toggle Button */}
          <button
            onClick={() => setIsEarphoneMode((prev) => !prev)}
            title={
              isEarphoneMode
                ? "Earphone Mode ON (Rain audio muted, visual rain active) - Key: E"
                : "Earphone Mode OFF (Mute rain audio for earphones) - Key: E"
            }
            className={`glass-pill px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isEarphoneMode
                ? "bg-purple-500/30 text-purple-200 border-purple-400/50 shadow-lg shadow-purple-950/50 ring-1 ring-purple-400/40"
                : "text-slate-300 hover:text-white hover:bg-white/15"
            }`}
          >
            <Headphones className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isEarphoneMode ? "text-purple-300 animate-pulse" : "text-slate-300"}`} />
            <span>
              {isEarphoneMode ? "Earphone: ON" : "Earphone Mode"}
            </span>
          </button>

          {/* Wiper Trigger */}
          <button
            onClick={triggerWiper}
            title="Trigger Windshield Wiper (Key: W)"
            className="glass-pill px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-slate-200 hover:text-white hover:bg-white/15 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
            <span>Wiper</span>
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={() => setShowShortcuts(true)}
            title="Keyboard Shortcuts (Key: ?)"
            className="glass-pill p-2 rounded-full text-slate-200 hover:text-white hover:bg-white/15 transition-all cursor-pointer shrink-0"
          >
            <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 my-auto text-center">
        {/* Left Floating Interactive Horn Panel */}
        <div className="fixed left-6 top-1/2 -translate-y-1/2 z-30 hidden lg:block">
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="glass-pill p-3.5 rounded-2xl border border-amber-400/40 shadow-2xl flex flex-col gap-2.5 bg-black/60 backdrop-blur-md text-left"
          >
            <div className="flex items-center gap-2 text-amber-300">
              <Volume2 className="w-5 h-5 animate-pulse text-amber-400" />
              <div>
                <p className="font-devanagari text-sm font-bold text-white tracking-wide leading-none">
                  हॉर्न ओके प्लीज
                </p>
                <p className="text-[10px] text-slate-300/80 font-mono tracking-tight mt-0.5">
                  Horn OK Please
                </p>
                <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-mono text-amber-300 font-semibold tracking-tight inline-block">
                  Developed by Abhishek Dubey "Ansh"
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => playHornSound(0)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  currentHornIdx === 0 && isHornActive
                    ? 'bg-amber-400 text-black border-amber-300 shadow-md scale-105'
                    : 'bg-white/10 text-amber-200 border-white/10 hover:bg-white/20'
                }`}
              >
                🎺 Horn 1
              </button>
              <button
                onClick={() => playHornSound(1)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  currentHornIdx === 1 && isHornActive
                    ? 'bg-amber-400 text-black border-amber-300 shadow-md scale-105'
                    : 'bg-white/10 text-amber-200 border-white/10 hover:bg-white/20'
                }`}
              >
                🎺 Horn 2
              </button>
            </div>
            <p className="text-[10px] text-slate-300/70 font-mono text-center pt-0.5">
              Press <kbd className="bg-amber-500/30 text-amber-200 px-1 py-0.5 rounded font-bold">H</kbd> to toggle
            </p>
          </motion.div>
        </div>

        {/* Central Display Title "ट्रक वाला" */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative inline-block my-2"
        >
          <h1 className="font-devanagari text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)] select-none">
            ट्रक वाला
          </h1>
          <span className="block text-xs sm:text-sm font-mono tracking-[0.3em] uppercase text-amber-300/90 mt-1 font-light">
            Indian Highway Nostalgia • 1990s
          </span>
        </motion.div>

        {/* Rotating Indian Truck Shayari */}
        <ShayariRotator />

        {/* Highway Details Badges (NH-28A / Highway Dhaba vibe) */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs font-mono text-slate-300/80">
          <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
            NH 28A • LUCKNOW TO GORAKHPUR
          </span>
          <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10 flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            DHABA CHAI: HOT ☕
          </span>
          <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            UP 32 XN 6158
          </span>
        </div>
      </main>

      {/* Mobile Horn Button Bar */}
      <div className="lg:hidden relative z-30 mb-3 sm:mb-4 flex flex-col items-center gap-1.5">
        <button
          onClick={() => playHornSound()}
          className="glass-pill px-5 py-2.5 rounded-full flex items-center gap-2.5 text-amber-300 font-devanagari text-sm font-semibold shadow-lg active:scale-95 transition-transform"
        >
          <Volume2 className="w-4 h-4" />
          <span>हॉर्न ओके प्लीज (Horn OK Please)</span>
        </button>
        <span className="text-[10px] font-mono text-amber-300/90 font-semibold px-2 py-0.5 rounded bg-black/60 border border-amber-500/30">
          Developed by Abhishek Dubey "Ansh"
        </span>
      </div>

      {/* Bottom Transparent Glassmorphic Music Player */}
      <MusicPlayer
        tracks={playlistTracks}
        currentTrack={currentTrack}
        currentTrackIndex={currentTrackIndex}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        onSelectTrack={handleSelectTrack}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Modals */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      <YouTubeVideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        youtubeId={currentTrack.youtubeId}
        songTitle={currentTrack.title}
      />

      {/* Embedded YouTube Audio Stream Controller */}
      <YouTubeAudioPlayer
        youtubeId={currentTrack.youtubeId}
        isPlaying={isPlaying && !showVideoModal}
        isMuted={isMuted}
        onEnded={handleNextTrack}
        onTimeUpdate={(cur, dur) => {
          setCurrentTime(cur);
          if (dur > 0) setDuration(dur);
        }}
        seekTime={seekTime}
        onSeekHandled={() => setSeekTime(null)}
        currentTrack={currentTrack}
        onPlayPause={handlePlayPause}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        onSeek={handleSeek}
      />

      {/* Dedicated Horn Sound Player */}
      <YouTubeHornPlayer
        hornIndex={currentHornIdx}
        youtubeId={HORN_SOUNDS[currentHornIdx]?.id || HORN_SOUNDS[0].id}
        triggerSignal={youtubeHornSignal}
        onPlayingChange={(playing) => setIsHornActive(playing)}
      />
    </div>
  );
}
