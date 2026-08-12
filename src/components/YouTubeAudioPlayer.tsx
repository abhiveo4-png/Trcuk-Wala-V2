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

// Minimal 1-second silent WAV audio data URI to maintain background audio wake-lock on mobile devices
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

// Public Piped / Invidious API instances for extracting direct native audio streams
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.col2.im',
  'https://pipedapi.sync.mobi',
  'https://inv.tux.pizza',
  'https://invidious.projectsegfau.lt',
  'https://invidious.privacydev.net',
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
  const wakeLockRef = useRef<any>(null);

  const [directAudioUrl, setDirectAudioUrl] = useState<string | null>(null);
  const [useNativeAudio, setUseNativeAudio] = useState<boolean>(false);

  // Request Wake Lock if available
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Ignore wake lock error
    }
  };

  // 1. Fetch direct native audio stream for seamless lock-screen & background playback
  useEffect(() => {
    if (!youtubeId) return;
    let isCancelled = false;

    const fetchAudioStream = async () => {
      setDirectAudioUrl(null);
      setUseNativeAudio(false);

      for (const instance of PIPED_INSTANCES) {
        if (isCancelled) break;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2000);
          const isPiped = instance.includes('piped');
          const endpoint = isPiped ? `${instance}/streams/${youtubeId}` : `${instance}/api/v1/videos/${youtubeId}`;

          const res = await fetch(endpoint, { signal: controller.signal });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            let audioStream: string | null = null;

            if (isPiped && Array.isArray(data.audioStreams)) {
              // Pick highest bitrate M4A/WebM audio stream
              const sorted = [...data.audioStreams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
              audioStream = sorted[0]?.url || null;
            } else if (!isPiped && Array.isArray(data.adaptiveFormats)) {
              const audioFormats = data.adaptiveFormats.filter((f: any) => f.type?.includes('audio') || f.mimeType?.includes('audio'));
              audioStream = audioFormats[0]?.url || null;
            }

            if (audioStream && !isCancelled) {
              setDirectAudioUrl(audioStream);
              setUseNativeAudio(true);
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

    fetchAudioStream();

    return () => {
      isCancelled = true;
    };
  }, [youtubeId]);

  // 2. Load YouTube Iframe API (Fallback)
  useEffect(() => {
    loadYouTubeIframeApi(() => {
      initPlayer();
    });

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore cleanup error
        }
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
          autoplay: isPlaying && !useNativeAudio ? 1 : 0,
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
              if (isMuted) event.target.mute();
              else event.target.unMute();

              if (isPlaying && !useNativeAudio) {
                event.target.playVideo();
              }
            } catch (err) {
              console.warn("Autoplay blocked or play failed", err);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0 && !useNativeAudio) {
              onEnded();
            }
          },
          onError: (event: any) => {
            console.warn("YouTube Audio Player error code:", event.data);
            if ([100, 101, 150].includes(event.data) && !useNativeAudio) {
              setTimeout(() => {
                onEnded();
              }, 1500);
            }
          }
        }
      });
    } catch (e) {
      console.warn("YouTube Player initialization error", e);
    }
  };

  // Change video ID when track changes in iFrame
  useEffect(() => {
    if (playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying && !useNativeAudio && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(youtubeId);
        } else if (typeof playerRef.current.cueVideoById === 'function') {
          playerRef.current.cueVideoById(youtubeId);
        }
      } catch (e) {
        console.warn("Error changing YouTube video ID", e);
      }
    }
  }, [youtubeId, useNativeAudio]);

  // Handle Play / Pause state across Native Audio & iFrame
  useEffect(() => {
    if (nativeAudioRef.current) {
      if (isPlaying) {
        nativeAudioRef.current.play().catch(() => {});
        requestWakeLock();
      } else {
        nativeAudioRef.current.pause();
      }
    }

    if (playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying && !useNativeAudio) {
          if (typeof playerRef.current.playVideo === 'function') {
            playerRef.current.playVideo();
          }
        } else {
          if (typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
          }
        }
      } catch (e) {
        console.warn("Error toggling play/pause", e);
      }
    }

    if (silentAudioRef.current) {
      if (isPlaying) {
        silentAudioRef.current.play().catch(() => {});
      } else {
        silentAudioRef.current.pause();
      }
    }
  }, [isPlaying, useNativeAudio]);

  // Sync Volume / Mute for Native Audio
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
      } catch (e) {
        console.warn("Error setting mute state", e);
      }
    }
  }, [isMuted]);

  // Handle Seeking
  useEffect(() => {
    if (seekTime !== null) {
      if (useNativeAudio && nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = seekTime;
        onSeekHandled();
      } else if (playerRef.current && isReadyRef.current) {
        try {
          if (typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(seekTime, true);
            onSeekHandled();
          }
        } catch (e) {
          console.warn("Error seeking in YouTube video", e);
        }
      }
    }
  }, [seekTime, useNativeAudio]);

  // Media Session API Integration for Lock Screen Controls and Metadata
  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (currentTrack) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.title || 'Highway Song',
            artist: currentTrack.artist || 'Highway FM 📻',
            album: currentTrack.movie || 'Highway Long Drive Hits',
            artwork: [
              { src: currentTrack.thumbnail || '/icon.png', sizes: '512x512', type: 'image/png' },
              { src: currentTrack.thumbnail || '/icon.png', sizes: '192x192', type: 'image/png' },
              { src: currentTrack.thumbnail || '/icon.png', sizes: '96x96', type: 'image/png' }
            ]
          });
        } catch (e) {
          console.warn('Error setting MediaSession metadata', e);
        }
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
          if (useNativeAudio && nativeAudioRef.current && onSeek) {
            const cur = nativeAudioRef.current.currentTime || 0;
            const skip = details.seekOffset || 10;
            onSeek(Math.max(cur - skip, 0));
          } else if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function' && onSeek) {
            const cur = playerRef.current.getCurrentTime() || 0;
            const skip = details.seekOffset || 10;
            onSeek(Math.max(cur - skip, 0));
          }
        }],
        ['seekforward', (details) => {
          if (useNativeAudio && nativeAudioRef.current && onSeek) {
            const cur = nativeAudioRef.current.currentTime || 0;
            const dur = nativeAudioRef.current.duration || 0;
            const skip = details.seekOffset || 10;
            onSeek(Math.min(cur + skip, dur));
          } else if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function' && onSeek) {
            const cur = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            const skip = details.seekOffset || 10;
            onSeek(Math.min(cur + skip, dur));
          }
        }]
      ];

      for (const [action, handler] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
          // Action might not be supported in browser
        }
      }
    }
  }, [currentTrack, isPlaying, useNativeAudio, onPlayPause, onNextTrack, onPrevTrack, onSeek]);

  // Maintain play state when page visibility changes (browser minimized or screen locked)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isPlaying) {
        if (silentAudioRef.current) {
          silentAudioRef.current.play().catch(() => {});
        }
        if (useNativeAudio && nativeAudioRef.current) {
          nativeAudioRef.current.play().catch(() => {});
        } else if (playerRef.current && isReadyRef.current && typeof playerRef.current.playVideo === 'function') {
          setTimeout(() => {
            try {
              playerRef.current.playVideo();
            } catch (e) {
              // ignore
            }
          }, 100);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, useNativeAudio]);

  // Poll progress and duration, update Media Session positionState
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        let cur = 0;
        let dur = 0;

        if (useNativeAudio && nativeAudioRef.current) {
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
                position: cur
              });
            } catch (e) {
              // ignore position state error
            }
          }
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, useNativeAudio]);

  return (
    <div
      ref={containerRef}
      className="fixed -left-[9999px] top-0 w-1 h-1 pointer-events-none opacity-0 z-0"
      aria-hidden="true"
    >
      {/* Native Audio Tag for Uninterrupted Mobile Lock Screen & Background Streaming */}
      {directAudioUrl && (
        <audio
          ref={nativeAudioRef}
          src={directAudioUrl}
          autoPlay={isPlaying}
          controls={false}
          preload="auto"
          onEnded={() => onEnded()}
          onError={() => {
            setUseNativeAudio(false);
          }}
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


