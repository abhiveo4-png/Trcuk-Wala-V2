import React, { useEffect, useRef } from 'react';
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

  // Load YouTube Iframe API
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
          autoplay: isPlaying ? 1 : 0,
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

              if (isPlaying) {
                event.target.playVideo();
              }
            } catch (err) {
              console.warn("Autoplay blocked or play failed", err);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              onEnded();
            }
          },
          onError: (event: any) => {
            console.warn("YouTube Audio Player error code:", event.data);
            if ([100, 101, 150].includes(event.data)) {
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
        if (isPlaying && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(youtubeId);
        } else if (typeof playerRef.current.cueVideoById === 'function') {
          playerRef.current.cueVideoById(youtubeId);
        }
      } catch (e) {
        console.warn("Error changing YouTube video ID", e);
      }
    }
  }, [youtubeId]);

  // Handle Play / Pause state & silent audio wake lock for background/lock-screen play
  useEffect(() => {
    if (playerRef.current && isReadyRef.current) {
      try {
        if (isPlaying) {
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
  }, [isPlaying]);

  // Sync Volume / Mute
  useEffect(() => {
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
    if (seekTime !== null && playerRef.current && isReadyRef.current) {
      try {
        if (typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(seekTime, true);
          onSeekHandled();
        }
      } catch (e) {
        console.warn("Error seeking in YouTube video", e);
      }
    }
  }, [seekTime]);

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
          if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function' && onSeek) {
            const cur = playerRef.current.getCurrentTime() || 0;
            const skip = details.seekOffset || 10;
            onSeek(Math.max(cur - skip, 0));
          }
        }],
        ['seekforward', (details) => {
          if (playerRef.current && isReadyRef.current && typeof playerRef.current.getCurrentTime === 'function' && onSeek) {
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
  }, [currentTrack, isPlaying, onPlayPause, onNextTrack, onPrevTrack, onSeek]);

  // Maintain play state when page visibility changes (browser minimized or screen locked)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isPlaying) {
        if (silentAudioRef.current) {
          silentAudioRef.current.play().catch(() => {});
        }
        if (playerRef.current && isReadyRef.current && typeof playerRef.current.playVideo === 'function') {
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
  }, [isPlaying]);

  // Poll progress and duration, update Media Session positionState
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        let cur = 0;
        let dur = 0;

        if (playerRef.current && isReadyRef.current) {
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
  }, [isPlaying]);

  return (
    <div
      ref={containerRef}
      className="fixed -left-[9999px] top-0 w-1 h-1 pointer-events-none opacity-0 z-0"
      aria-hidden="true"
    >
      {/* Silent audio wake-lock tag for background playback on mobile browsers */}
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
