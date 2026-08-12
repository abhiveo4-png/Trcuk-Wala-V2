import React, { useEffect, useRef, useState } from 'react';
import { loadYouTubeIframeApi } from '../utils/youtubeApi';
import { Track } from '../types';

interface YouTubeAudioPlayerProps {
  youtubeId: string;
  isPlaying: boolean;
  isMuted: boolean;
  onEnded: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  seekTime: number | null;
  onSeekHandled: () => void;
  currentTrack?: Track;
  onPlayPause?: () => void;
  onNextTrack?: () => void;
  onPrevTrack?: () => void;
  onSeek?: (time: number) => void;
}

// Minimal silent WAV audio loop to maintain mobile browser wake-lock on background / screen lock
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

// Fast direct audio stream endpoints for YouTube track IDs
const AUDIO_STREAM_ENDPOINTS = [
  (id: string) => `https://pipedapi.kavin.rocks/streams/${id}`,
  (id: string) => `https://api.piped.privacydev.net/streams/${id}`,
  (id: string) => `https://pipedapi.adminforge.de/streams/${id}`,
  (id: string) => `https://invidious.nerdvpn.de/api/v1/videos/${id}`,
  (id: string) => `https://yewtu.be/api/v1/videos/${id}`,
];

export const YouTubeAudioPlayer: React.FC<YouTubeAudioPlayerProps> = ({
  youtubeId,
  isPlaying,
  isMuted,
  onEnded,
  onTimeUpdate,
  seekTime,
  onSeekHandled,
  currentTrack,
  onPlayPause,
  onNextTrack,
  onPrevTrack,
  onSeek,
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReadyRef = useRef<boolean>(false);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);

  const [nativeAudioUrl, setNativeAudioUrl] = useState<string | null>(null);
  const [usingNativeAudio, setUsingNativeAudio] = useState<boolean>(false);

  // Initialize Web Audio API Keep-Alive Context
  const keepAliveCtxRef = useRef<AudioContext | null>(null);

  const startKeepAliveContext = () => {
    try {
      if (!keepAliveCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          keepAliveCtxRef.current = ctx;
        }
      } else if (keepAliveCtxRef.current.state === 'suspended') {
        keepAliveCtxRef.current.resume().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  // Attempt to resolve direct audio stream for background play
  useEffect(() => {
    if (!youtubeId) return;
    let cancelled = false;

    const fetchStreamUrl = async () => {
      setNativeAudioUrl(null);
      setUsingNativeAudio(false);

      for (const getUrl of AUDIO_STREAM_ENDPOINTS) {
        if (cancelled) break;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);

          const endpoint = getUrl(youtubeId);
          const res = await fetch(endpoint, { signal: controller.signal });
          clearTimeout(timeout);

          if (res.ok) {
            const data = await res.json();
            let audioUrl: string | null = null;

            if (Array.isArray(data.audioStreams)) {
              const sorted = [...data.audioStreams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
              audioUrl = sorted[0]?.url || null;
            } else if (Array.isArray(data.adaptiveFormats)) {
              const audioFormats = data.adaptiveFormats.filter((f: any) =>
                f.type?.includes('audio') || f.mimeType?.includes('audio')
              );
              audioUrl = audioFormats[0]?.url || null;
            }

            if (audioUrl && !cancelled) {
              setNativeAudioUrl(audioUrl);
              setUsingNativeAudio(true);
              // Pause iframe if running
              if (playerRef.current && isReadyRef.current && typeof playerRef.current.pauseVideo === 'function') {
                try {
                  playerRef.current.pauseVideo();
                } catch (e) {}
              }
              break;
            }
          }
        } catch {
          continue;
        }
      }
    };

    fetchStreamUrl();

    return () => {
      cancelled = true;
    };
  }, [youtubeId]);

  // Load YouTube Iframe API as Fallback
  useEffect(() => {
    loadYouTubeIframeApi(() => {
      initPlayer();
    });

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, []);

  const initPlayer = () => {
    if (playerRef.current || !containerRef.current || !window.YT || !window.YT.Player) return;

    try {
      playerRef.current = new window.YT.Player('yt-audio-element', {
        height: '180',
        width: '320',
        videoId: youtubeId,
        playerVars: {
          autoplay: isPlaying && !usingNativeAudio ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: any) => {
            isReadyRef.current = true;
            try {
              if (isMuted) event.target.mute();
              else event.target.unMute();

              if (isPlaying && !usingNativeAudio) {
                event.target.playVideo();
              }
            } catch (err) {
              console.warn('Autoplay blocked or play failed', err);
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 0 && !usingNativeAudio) {
              onEnded();
            }
          },
          onError: (event: any) => {
            if ([100, 101, 150].includes(event.data) && !usingNativeAudio) {
              setTimeout(() => {
                onEnded();
              }, 1500);
            }
          },
        },
      });
    } catch (e) {
      console.warn('YouTube Player initialization error', e);
    }
  };

  // Sync YouTube iFrame Video ID
  useEffect(() => {
    if (playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying && !usingNativeAudio && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(youtubeId);
        } else if (typeof playerRef.current.cueVideoById === 'function') {
          playerRef.current.cueVideoById(youtubeId);
        }
      } catch (e) {}
    }
  }, [youtubeId, usingNativeAudio]);

  // Sync Play / Pause state across Native HTML5 Audio and YouTube iFrame
  useEffect(() => {
    startKeepAliveContext();

    if (usingNativeAudio && nativeAudioRef.current) {
      if (isPlaying) {
        nativeAudioRef.current.play().catch(() => {});
      } else {
        nativeAudioRef.current.pause();
      }
    }

    if (playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying && !usingNativeAudio) {
          if (typeof playerRef.current.playVideo === 'function') {
            playerRef.current.playVideo();
          }
        } else {
          if (typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
          }
        }
      } catch (e) {}
    }

    if (silentAudioRef.current) {
      if (isPlaying) {
        silentAudioRef.current.play().catch(() => {});
      } else {
        silentAudioRef.current.pause();
      }
    }
  }, [isPlaying, usingNativeAudio]);

  // Sync Mute state
  useEffect(() => {
    if (nativeAudioRef.current) {
      nativeAudioRef.current.muted = isMuted;
    }
    if (playerRef.current && isReadyRef.current) {
      try {
        if (isMuted) {
          if (typeof playerRef.current.mute === 'function') playerRef.current.mute();
        } else {
          if (typeof playerRef.current.unMute === 'function') playerRef.current.unMute();
        }
      } catch (e) {}
    }
  }, [isMuted]);

  // Sync Seeking
  useEffect(() => {
    if (seekTime !== null) {
      if (usingNativeAudio && nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = seekTime;
        onSeekHandled();
      } else if (playerRef.current && isReadyRef.current) {
        try {
          if (typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(seekTime, true);
            onSeekHandled();
          }
        } catch (e) {}
      }
    }
  }, [seekTime, usingNativeAudio]);

  // Media Session API Integration (Lock Screen Controls and System Notification)
  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (currentTrack) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.title || 'Highway FM Track',
            artist: currentTrack.artist || 'Highway FM 📻',
            album: currentTrack.movie || 'Long Drive Playlist',
            artwork: [
              { src: currentTrack.thumbnail || '/icon.png', sizes: '512x512', type: 'image/png' },
              { src: currentTrack.thumbnail || '/icon.png', sizes: '192x192', type: 'image/png' },
              { src: currentTrack.thumbnail || '/icon.png', sizes: '96x96', type: 'image/png' },
            ],
          });
        } catch (e) {}
      }

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      const actionHandlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
        ['play', () => { if (onPlayPause) onPlayPause(); }],
        ['pause', () => { if (onPlayPause) onPlayPause(); }],
        ['previoustrack', () => { if (onPrevTrack) onPrevTrack(); }],
        ['nexttrack', () => { if (onNextTrack) onNextTrack(); }],
        ['seekto', (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null && onSeek) {
            onSeek(details.seekTime);
          }
        }],
        ['seekbackward', (details) => {
          let cur = 0;
          if (usingNativeAudio && nativeAudioRef.current) {
            cur = nativeAudioRef.current.currentTime || 0;
          } else if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            cur = playerRef.current.getCurrentTime() || 0;
          }
          if (onSeek) onSeek(Math.max(cur - 10, 0));
        }],
        ['seekforward', (details) => {
          let cur = 0;
          let dur = 0;
          if (usingNativeAudio && nativeAudioRef.current) {
            cur = nativeAudioRef.current.currentTime || 0;
            dur = nativeAudioRef.current.duration || 0;
          } else if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            cur = playerRef.current.getCurrentTime() || 0;
            dur = playerRef.current.getDuration() || 0;
          }
          if (onSeek) onSeek(Math.min(cur + 10, dur));
        }],
      ];

      for (const [action, handler] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {}
      }
    }
  }, [currentTrack, isPlaying, usingNativeAudio, onPlayPause, onNextTrack, onPrevTrack, onSeek]);

  // Keep playback running when tab visibility or screen lock changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isPlaying) {
        if (silentAudioRef.current) {
          silentAudioRef.current.play().catch(() => {});
        }
        if (usingNativeAudio && nativeAudioRef.current) {
          nativeAudioRef.current.play().catch(() => {});
        } else if (playerRef.current && isReadyRef.current && typeof playerRef.current.playVideo === 'function') {
          setTimeout(() => {
            try {
              playerRef.current.playVideo();
            } catch (e) {}
          }, 100);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, usingNativeAudio]);

  // Progress update interval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        let cur = 0;
        let dur = 0;

        if (usingNativeAudio && nativeAudioRef.current) {
          cur = nativeAudioRef.current.currentTime || 0;
          dur = nativeAudioRef.current.duration || 0;
        } else if (playerRef.current && isReadyRef.current) {
          try {
            if (typeof playerRef.current.getCurrentTime === 'function') {
              cur = playerRef.current.getCurrentTime() || 0;
              dur = playerRef.current.getDuration() || 0;
            }
          } catch (e) {}
        }

        if (dur > 0) {
          onTimeUpdate(cur, dur);

          if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && cur >= 0 && cur <= dur) {
            try {
              navigator.mediaSession.setPositionState({
                duration: dur,
                playbackRate: 1,
                position: cur,
              });
            } catch (e) {}
          }
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, usingNativeAudio]);

  return (
    <div
      ref={containerRef}
      className="fixed -left-[9999px] top-0 w-1 h-1 pointer-events-none opacity-0 z-0"
      aria-hidden="true"
    >
      {/* Native HTML5 Audio Tag for Uninterrupted Mobile Lock Screen & Background Streaming */}
      {nativeAudioUrl && (
        <audio
          ref={nativeAudioRef}
          src={nativeAudioUrl}
          autoPlay={isPlaying}
          controls={false}
          preload="auto"
          onEnded={() => onEnded()}
          onError={() => setUsingNativeAudio(false)}
        />
      )}

      {/* Silent audio wake-lock tag for mobile browsers */}
      <audio
        ref={silentAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        preload="auto"
        style={{ display: 'none' }}
      />

      <div id="yt-audio-element" />
    </div>
  );
};
