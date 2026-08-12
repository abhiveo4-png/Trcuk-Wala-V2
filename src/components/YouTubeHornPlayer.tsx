import React, { useEffect, useRef, useState } from 'react';
import { loadYouTubeIframeApi } from '../utils/youtubeApi';

interface YouTubeHornPlayerProps {
  hornIndex: number; // 0 for Horn 1, 1 for Horn 2
  youtubeId: string;
  triggerSignal: number; // Increment to trigger horn playback
  onPlayingChange?: (isPlaying: boolean) => void;
}

export const YouTubeHornPlayer: React.FC<YouTubeHornPlayerProps> = ({
  hornIndex,
  youtubeId,
  triggerSignal,
  onPlayingChange
}) => {
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize YT Horn Player
  useEffect(() => {
    loadYouTubeIframeApi(() => {
      initYTPlayer();
    });
  }, []);

  const initYTPlayer = () => {
    if (playerRef.current || !window.YT || !window.YT.Player) return;

    const elem = document.getElementById('yt-horn-player-element');
    if (!elem) return;

    try {
      playerRef.current = new window.YT.Player('yt-horn-player-element', {
        height: '180',
        width: '320',
        videoId: youtubeId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1
        },
        events: {
          onReady: (event: any) => {
            isReadyRef.current = true;
            try {
              event.target.unMute();
              event.target.setVolume(100);
            } catch (e) {}
          },
          onStateChange: (event: any) => {
            if (event.data === 1) { // PLAYING
              onPlayingChange?.(true);
            } else if (event.data === 0 || event.data === 2) { // ENDED or PAUSED
              onPlayingChange?.(false);
            }
          },
          onError: (event: any) => {
            console.warn('YouTube Horn Player error:', event.data);
            onPlayingChange?.(false);
          }
        }
      });
    } catch (e) {
      console.warn('YouTube Horn Player init error:', e);
    }
  };

  // Web Audio Synthesizer for Indian Truck Horn (Fallback)
  const playSynthesizedHorn = (type: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Indian Truck Dual-Tone Horn frequencies (Basuri vibe)
      const baseFreqs = type === 0 ? [370, 466.16, 554.37] : [440, 554.37, 659.25];

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.4, now);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      masterGain.connect(ctx.destination);

      baseFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        // Trumpet/Horn pitch bend at start
        osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + 0.1);
        osc.frequency.setValueAtTime(freq, now + 0.3);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 1.8);
      });

      onPlayingChange?.(true);
      setTimeout(() => onPlayingChange?.(false), 1800);
    } catch (e) {
      console.warn('Synthesized horn error:', e);
    }
  };

  // Play horn when triggerSignal increments
  useEffect(() => {
    if (triggerSignal <= 0) return;

    // For Horn 2 (or any YouTube-assigned horn), play directly via YouTube player
    if (hornIndex === 1) {
      if (playerRef.current && isReadyRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          playerRef.current.loadVideoById({
            videoId: youtubeId,
            startSeconds: 0
          });
          onPlayingChange?.(true);
          return;
        } catch (e) {
          console.warn('Playing YT horn 2 failed, falling back to Web Audio synth', e);
        }
      }
      playSynthesizedHorn(hornIndex);
      return;
    }

    const mp3File = '/sounds/horn1.mp3';
    let playedLocal = false;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio(mp3File);
      audioRef.current = audio;
      audio.volume = 1.0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playedLocal = true;
            onPlayingChange?.(true);
            audio.onended = () => onPlayingChange?.(false);
          })
          .catch(() => {
            // Local MP3 play failed, fall back to YT or Web Audio
            playFallback();
          });
      }
    } catch (e) {
      playFallback();
    }

    function playFallback() {
      if (!playedLocal && playerRef.current && isReadyRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
          playerRef.current.loadVideoById({
            videoId: youtubeId,
            startSeconds: 0
          });
          onPlayingChange?.(true);
          return;
        } catch (e) {
          console.warn('Playing YT horn failed, using Web Audio synth', e);
        }
      }
      playSynthesizedHorn(hornIndex);
    }
  }, [triggerSignal, hornIndex, youtubeId]);

  return (
    <div className="fixed -left-[9999px] top-0 w-[320px] h-[180px] pointer-events-none opacity-0 z-0">
      <div id="yt-horn-player-element" />
    </div>
  );
};
