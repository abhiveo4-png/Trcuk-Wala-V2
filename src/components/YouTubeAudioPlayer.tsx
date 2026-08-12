import React, { useEffect, useRef } from 'react';
import { loadYouTubeIframeApi } from '../utils/youtubeApi';

interface YouTubeAudioPlayerProps {
  youtubeId: string;
  isPlaying: boolean;
  isMuted: boolean;
  onEnded: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  seekTime: number | null;
  onSeekHandled: () => void;
}

export const YouTubeAudioPlayer: React.FC<YouTubeAudioPlayerProps> = ({
  youtubeId,
  isPlaying,
  isMuted,
  onEnded,
  onTimeUpdate,
  seekTime,
  onSeekHandled
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isReadyRef = useRef<boolean>(false);

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
            // On unplayable video error (100, 101, 150), skip to next track
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

  // Change video ID when track changes
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

  // Handle Play / Pause state
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
  }, [isPlaying]);

  // Handle Mute state
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

  // Poll progress and duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        if (playerRef.current && isReadyRef.current) {
          try {
            if (typeof playerRef.current.getCurrentTime === 'function') {
              const cur = playerRef.current.getCurrentTime() || 0;
              const dur = playerRef.current.getDuration() || 0;
              onTimeUpdate(cur, dur);
            }
          } catch (e) {
            // silent ignore during state transition
          }
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div ref={containerRef} className="fixed -left-[9999px] top-0 w-[320px] h-[180px] pointer-events-none opacity-0 z-0">
      <div id="yt-audio-element" />
    </div>
  );
};
