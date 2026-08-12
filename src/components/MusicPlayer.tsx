import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Search,
  ListMusic,
  Volume2,
  VolumeX,
  X,
  Disc,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Music
} from 'lucide-react';
import { Track } from '../types';

interface MusicPlayerProps {
  tracks: Track[];
  currentTrack: Track;
  currentTrackIndex: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSelectTrack: (track: Track) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  tracks,
  currentTrack,
  currentTrackIndex,
  isPlaying,
  onPlayPause,
  onNextTrack,
  onPrevTrack,
  onSelectTrack,
  currentTime,
  duration,
  onSeek,
  isMuted,
  onToggleMute
}) => {
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ytSearchResults, setYtSearchResults] = useState<Track[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytSearchError, setYtSearchError] = useState('');

  const activeTrack = currentTrack || tracks[currentTrackIndex] || tracks[0];
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    onSeek(percentage * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Search logic
  const localFilteredTracks = tracks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.movie && t.movie.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

  // Helper to extract YouTube Video ID from any URL or string
  const extractYouTubeId = (input: string): string | null => {
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const handleSearchSubmit = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setYtSearchResults([]);
      return;
    }

    setIsSearchingYt(true);
    setYtSearchError('');

    // 1. Direct YouTube Video Link or Video ID Check (Instant Zero-API)
    const directYtId = extractYouTubeId(q);
    if (directYtId) {
      let songTitle = `YouTube Video (${directYtId})`;
      let channelName = 'Direct YouTube Stream';
      let thumbUrl = `https://i.ytimg.com/vi/${directYtId}/hqdefault.jpg`;

      // Fetch real video metadata using free CORS-friendly YouTube oEmbed
      try {
        const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${directYtId}`);
        if (oembedRes.ok) {
          const odata = await oembedRes.json();
          if (odata.title) songTitle = odata.title;
          if (odata.author_name) channelName = odata.author_name;
          if (odata.thumbnail_url) thumbUrl = odata.thumbnail_url;
        }
      } catch {
        // use fallback title & thumbnail
      }

      const directTrack: Track = {
        id: `yt-direct-${directYtId}-${Date.now()}`,
        youtubeId: directYtId,
        title: songTitle,
        artist: channelName,
        movie: 'YouTube Online Stream 📻',
        duration: '4:00',
        durationSeconds: 240,
        thumbnail: thumbUrl,
        description: 'Direct YouTube Stream'
      };

      setYtSearchResults([directTrack]);
      setIsSearchingYt(false);
      onSelectTrack(directTrack);
      setShowPlaylist(false);
      return;
    }

    try {
      let tracksFound: Track[] = [];
      const encoded = encodeURIComponent(q);

      // 2. Official Google YouTube Data API v3 Search (Primary)
      const YT_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY || 'AIzaSyCokO65F1348yAwjeARYhrM6jXnrkAH224').trim();
      if (YT_KEY) {
        try {
          const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encoded}&type=video&key=${YT_KEY}`;
          const ytRes = await fetch(ytUrl);
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            if (ytData.items && ytData.items.length > 0) {
              tracksFound = ytData.items.map((item: any, idx: number) => {
                const videoId = item.id?.videoId || item.id;
                const snippet = item.snippet || {};
                const rawTitle = snippet.title || 'YouTube Track';
                const cleanTitle = rawTitle.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
                return {
                  id: `yt-official-${videoId || idx}-${Date.now()}`,
                  youtubeId: videoId,
                  title: cleanTitle,
                  artist: snippet.channelTitle || 'YouTube Channel',
                  movie: 'Official YouTube Stream 📻',
                  duration: '4:15',
                  durationSeconds: 255,
                  thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                  description: snippet.description || 'YouTube Music Track'
                };
              }).filter((t: Track) => t.youtubeId);
            }
          }
        } catch {
          // continue to fallbacks
        }
      }

      // 3. Fallback: Query free public open-source Invidious & Piped music mirrors
      if (tracksFound.length === 0) {
        const publicEndpoints = [
          `https://pipedapi.kavin.rocks/search?q=${encoded}&filter=all`,
          `https://api.piped.privacydev.net/search?q=${encoded}&filter=all`,
          `https://inv.tux.pizza/api/v1/search?q=${encoded}&type=video`,
          `https://invidious.projectsegfau.lt/api/v1/search?q=${encoded}&type=video`,
          `https://invidious.privacydev.net/api/v1/search?q=${encoded}&type=video`,
        ];

        for (const url of publicEndpoints) {
          try {
            const instController = new AbortController();
            const instTimeout = setTimeout(() => instController.abort(), 2200);
            const res = await fetch(url, { signal: instController.signal });
            clearTimeout(instTimeout);

            if (res.ok) {
              const data = await res.json();
              const items = Array.isArray(data) ? data : (data.items || []);
              if (items.length > 0) {
                tracksFound = items.slice(0, 8).map((item: any, idx: number) => {
                  const videoId = item.videoId || item.id?.videoId || (typeof item.id === 'string' ? item.id : null);
                  const title = item.title || item.snippet?.title || `${q} Track ${idx + 1}`;
                  const artist = item.uploaderName || item.author || item.snippet?.channelTitle || 'YouTube Stream';
                  const thumbnail = item.thumbnail || item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                  const durationSec = item.duration || 250;

                  return {
                    id: `yt-noapi-${videoId || idx}-${Date.now()}`,
                    youtubeId: videoId || '',
                    title,
                    artist,
                    movie: 'YouTube Stream 📻',
                    duration: item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : '4:15',
                    durationSeconds: durationSec,
                    thumbnail,
                    description: 'Online Stream'
                  };
                }).filter((t: Track) => t.youtubeId);

                if (tracksFound.length > 0) break;
              }
            }
          } catch {
            continue;
          }
        }
      }

      // 3. Query Google Autosuggest + iTunes Music API (100% Uptime Zero-API Global CDN)
      if (tracksFound.length === 0) {
        try {
          const suggestRes = await fetch(
            `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encoded}`
          );
          if (suggestRes.ok) {
            const suggestData = await suggestRes.json();
            const suggestions: string[] = suggestData[1] || [];
            
            if (suggestions.length > 0) {
              const topQuery = suggestions[0];
              const itunesRes = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(topQuery)}&media=music&entity=song&limit=8`
              );
              if (itunesRes.ok) {
                const itunesData = await itunesRes.json();
                if (itunesData.results && itunesData.results.length > 0) {
                  tracksFound = itunesData.results.map((item: any) => ({
                    id: `track-noapi-${item.trackId}`,
                    youtubeId: '',
                    title: item.trackName,
                    artist: item.artistName,
                    movie: item.collectionName || 'Highway Online Stream 📻',
                    duration: item.trackTimeMillis ? `${Math.floor(item.trackTimeMillis / 60000)}:${String(Math.floor((item.trackTimeMillis % 60000) / 1000)).padStart(2, '0')}` : '3:45',
                    durationSeconds: Math.floor((item.trackTimeMillis || 220000) / 1000),
                    thumbnail: item.artworkUrl100?.replace('100x100bb', '300x300bb') || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
                    description: 'Online Song Preview'
                  }));
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 4. Fallback to /api/youtube-search if endpoint exists
      if (tracksFound.length === 0) {
        try {
          const res = await fetch(`/api/youtube-search?q=${encoded}`);
          if (res.ok) {
            const data = await res.json();
            if (data.tracks && data.tracks.length > 0) {
              tracksFound = data.tracks;
            }
          }
        } catch {
          // ignore
        }
      }

      if (tracksFound.length > 0) {
        setYtSearchResults(tracksFound);
      } else {
        setYtSearchResults([]);
        setYtSearchError('Koi gana nahi mila. Koi doosra keyword ya YouTube Link paste karein.');
      }
    } catch (err) {
      console.error('YouTube search error:', err);
      setYtSearchError('YouTube search connection error.');
    } finally {
      setIsSearchingYt(false);
    }
  };

  const handleOpenSearch = () => {
    setShowPlaylist(true);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 150);
  };

  return (
    <>
      {/* Minimized Ultra-Compact Floating Pill Mode */}
      {isMinimized ? (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-[#0F172A]/40 backdrop-blur-2xl rounded-full px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 sm:gap-3 shadow-2xl border border-white/20">
            <div
              onClick={() => setShowPlaylist(true)}
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-amber-400/50 cursor-pointer shrink-0"
              title="Click to view playlist"
            >
              <img
                src={activeTrack.thumbnail}
                alt={activeTrack.title}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
              />
            </div>

            <div
              onClick={() => setIsMinimized(false)}
              className="flex flex-col text-left cursor-pointer max-w-[130px] sm:max-w-[200px] overflow-hidden"
              title="Click to expand music player"
            >
              <span className="text-xs font-bold text-white truncate">
                {activeTrack.title}
              </span>
              <span className="text-[10px] text-amber-200/80 truncate">
                {activeTrack.artist}
              </span>
            </div>

            <button
              onClick={onPlayPause}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-white text-slate-950 rounded-full flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-slate-950 stroke-slate-950" />
              ) : (
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-slate-950 stroke-slate-950 ml-0.5" />
              )}
            </button>

            <button
              onClick={onNextTrack}
              className="p-1 text-slate-200 hover:text-white transition-all cursor-pointer shrink-0"
              title="Next Track"
            >
              <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            </button>

            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer shrink-0 ml-1"
              title="Expand Player"
            >
              <ChevronUp className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>
      ) : (
        /* Full Transparent Glassmorphism Player Bar at Bottom Center */
        <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] sm:w-[88%] max-w-xl sm:max-w-2xl md:max-w-3xl">
          <div className="bg-[#0B0F19]/35 sm:bg-[#0B0F19]/40 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 flex flex-col gap-2 sm:gap-2.5 shadow-2xl relative overflow-hidden">
            {/* Subtle translucent glowing gradient inside player */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-red-500/10 to-indigo-500/10 pointer-events-none opacity-70" />

            {/* Top Row: Track Info (Left), Controls (Center/Right) & Minimize Button */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 relative z-10 w-full">
              {/* Left: Thumbnail + Track details */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 min-w-0">
                <div
                  onClick={() => setShowPlaylist(true)}
                  className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white/20 shadow-md group cursor-pointer shrink-0"
                  title="View Playlist"
                >
                  <img
                    src={activeTrack.thumbnail}
                    alt={activeTrack.title}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-transform duration-700 ${
                      isPlaying ? 'animate-spin-slow' : 'scale-100'
                    }`}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                    <Disc className="w-4 h-4 text-white/70 group-hover:scale-110 transition-transform" />
                  </div>
                </div>

                {/* Song title & artist */}
                <div className="flex flex-col text-left max-w-[130px] sm:max-w-[200px] md:max-w-[280px] overflow-hidden">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                    {activeTrack.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-300/90 truncate font-light">
                    {activeTrack.artist}
                  </p>
                </div>
              </div>

              {/* Right: Player Controls (Search Button replacing Shuffle) & Minimize Toggle */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Search Button (Replaces Shuffle) */}
                <button
                  onClick={handleOpenSearch}
                  title="Gana Khojein / Playlist & YouTube Search"
                  className="p-1.5 sm:p-2 rounded-full transition-all cursor-pointer text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 active:scale-95"
                >
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                </button>

                <button
                  onClick={onPrevTrack}
                  title="Previous Track (Key: Left Arrow)"
                  className="p-1.5 sm:p-2 text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                </button>

                <button
                  onClick={onPlayPause}
                  title={isPlaying ? 'Pause (Key: Space)' : 'Play (Key: Space)'}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-white text-slate-950 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-slate-950 stroke-slate-950" />
                  ) : (
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-slate-950 stroke-slate-950 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={onNextTrack}
                  title="Next Track (Key: Right Arrow)"
                  className="p-1.5 sm:p-2 text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                </button>

                <button
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  title="Playlist Queue"
                  className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${
                    showPlaylist ? 'text-amber-300 bg-white/20 border border-white/20' : 'text-slate-300/80 hover:text-white'
                  }`}
                >
                  <ListMusic className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={onToggleMute}
                  title={isMuted ? 'Unmute' : 'Mute (Key: M)'}
                  className="hidden sm:block p-1.5 sm:p-2 text-slate-300/80 hover:text-white transition-all cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Minimize Button */}
                <button
                  onClick={() => setIsMinimized(true)}
                  title="Minimize Player"
                  className="p-1.5 sm:p-2 rounded-full text-amber-200/80 hover:text-amber-300 hover:bg-white/10 transition-all cursor-pointer border border-white/10 ml-0.5"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom Row: Full-width Seek Bar */}
            <div className="w-full flex items-center gap-2 sm:gap-3 pt-0.5 relative z-10">
              {/* Current Time */}
              <span className="text-[10px] sm:text-xs font-mono text-slate-300/90 shrink-0 min-w-[32px] text-right">
                {formatTime(currentTime)}
              </span>

              {/* Full-width Scrubber Track */}
              <div
                ref={progressBarRef}
                onClick={handleProgressBarClick}
                className="flex-1 h-1.5 sm:h-2 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer relative group transition-all flex items-center"
              >
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 rounded-full relative shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-white rounded-full shadow-lg scale-90 group-hover:scale-125 transition-transform border-2 border-amber-500" />
                </div>
              </div>

              {/* Total Duration */}
              <span className="text-[10px] sm:text-xs font-mono text-slate-300/90 shrink-0 min-w-[32px] text-left">
                {formatTime(duration || activeTrack.durationSeconds)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Transparent Playlist Drawer & Search Modal */}
      <AnimatePresence>
        {showPlaylist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4"
            onClick={() => setShowPlaylist(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0B0F19]/60 backdrop-blur-2xl w-full max-w-lg rounded-2xl p-4 sm:p-5 border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                    Truck Highway Playlist
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {tracks.length} tracks
                  </span>
                </div>
                <button
                  onClick={() => setShowPlaylist(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="my-3 relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchSubmit();
                    }}
                    placeholder="Gana, artist ya movie search karein..."
                    className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 focus:border-amber-400/60 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-400 outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setYtSearchResults([]);
                        setYtSearchError('');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSearchSubmit}
                  disabled={isSearchingYt}
                  className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shrink-0 active:scale-95 disabled:opacity-50"
                  title="Search on YouTube"
                >
                  {isSearchingYt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Search Online</span>
                    </>
                  )}
                </button>
              </div>

              {/* Search Results / Track List Container */}
              <div className="overflow-y-auto my-1 space-y-1.5 pr-1 flex-1">
                {/* Local Playlist Results Section */}
                {localFilteredTracks.length > 0 && (
                  <div>
                    {searchQuery.trim() && (
                      <div className="px-1 py-1 text-[11px] font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Music className="w-3 h-3 text-amber-400" />
                        <span>Playlist Results ({localFilteredTracks.length})</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {localFilteredTracks.map((track) => {
                        const isCurrent = track.youtubeId === activeTrack.youtubeId || track.id === activeTrack.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => {
                              onSelectTrack(track);
                              setShowPlaylist(false);
                            }}
                            title={track.description || track.title}
                            className={`flex items-center gap-3 p-2 sm:p-2.5 rounded-xl cursor-pointer transition-all ${
                              isCurrent
                                ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/50 text-white shadow-md'
                                : 'bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                              <img
                                src={track.thumbnail}
                                alt={track.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              {isCurrent && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <Disc className="w-4 h-4 text-amber-300 animate-spin-slow" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 text-left">
                              <p className={`text-xs sm:text-sm font-medium truncate ${isCurrent ? 'text-amber-200 font-bold' : 'text-slate-100'}`}>
                                {track.title}
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                                {track.movie ? `${track.movie} • ` : ''}{track.artist}
                              </p>
                            </div>

                            <span className="text-[10px] sm:text-xs font-mono text-slate-400/80">
                              {track.duration}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Prompt to search YouTube if query typed and few or 0 local matches */}
                {searchQuery.trim() && localFilteredTracks.length === 0 && !isSearchingYt && ytSearchResults.length === 0 && (
                  <div className="p-4 text-center rounded-xl bg-white/5 border border-white/10 my-2">
                    <p className="text-xs sm:text-sm text-slate-300 mb-2">
                      Playlist me "{searchQuery}" nahi mila.
                    </p>
                    <button
                      onClick={handleSearchSubmit}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 shadow-lg cursor-pointer hover:scale-105 transition-all w-full sm:w-auto"
                    >
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>Truck Me Gana Nahi Mila , Kisi Or Ke Truck Me Dekhe</span>
                    </button>
                  </div>
                )}

                {/* Searching Loader Indicator */}
                {isSearchingYt && (
                  <div className="p-6 text-center flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                    <p className="text-xs text-amber-200">YouTube se gana dhoondh rahe hain...</p>
                  </div>
                )}

                {/* YouTube Error Message */}
                {ytSearchError && (
                  <p className="p-3 text-center text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl my-2">
                    {ytSearchError}
                  </p>
                )}

                {/* YouTube Online Search Results Section */}
                {ytSearchResults.length > 0 && (
                  <div className="pt-2">
                    <div className="px-1 py-1.5 text-[11px] font-semibold text-amber-300 uppercase tracking-wider flex items-center justify-between border-t border-white/10 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>YouTube Search Results ({ytSearchResults.length})</span>
                      </div>
                      <span className="text-[10px] text-slate-400 lowercase font-normal">Click to play</span>
                    </div>

                    <div className="space-y-1.5">
                      {ytSearchResults.map((track) => (
                        <div
                          key={track.id}
                          onClick={() => {
                            onSelectTrack(track);
                            setShowPlaylist(false);
                          }}
                          title={`Play ${track.title}`}
                          className="flex items-center gap-3 p-2 sm:p-2.5 rounded-xl cursor-pointer transition-all bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-slate-200 hover:text-white"
                        >
                          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0 border border-amber-400/30">
                            <img
                              src={track.thumbnail}
                              alt={track.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 hover:bg-black/0 flex items-center justify-center">
                              <Play className="w-4 h-4 text-amber-300 fill-amber-300" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs sm:text-sm font-medium text-amber-100 truncate">
                              {track.title}
                            </p>
                            <p className="text-[10px] sm:text-xs text-slate-300/80 truncate">
                              {track.artist}
                            </p>
                          </div>

                          <span className="text-[10px] sm:text-xs font-mono text-amber-300/80 shrink-0">
                            {track.duration}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Highway Playlist 🚛</span>
                <span className="text-[10px] text-amber-300/80">Search & Play Any Song</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
