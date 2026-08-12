import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tv, ExternalLink } from 'lucide-react';

interface YouTubeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  youtubeId: string;
  songTitle: string;
}

export const YouTubeVideoModal: React.FC<YouTubeVideoModalProps> = ({
  isOpen,
  onClose,
  youtubeId,
  songTitle
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card w-full max-w-3xl rounded-2xl overflow-hidden border border-white/20 shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-3.5 bg-black/40 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-white tracking-wide truncate max-w-md">
                Playing Video: {songTitle}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`https://www.youtube.com/watch?v=${youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-300 hover:underline flex items-center gap-1 mr-2"
              >
                Watch on YouTube <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative w-full aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
              title={songTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
