import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard, Volume2, CloudRain, Sparkles, Disc, Headphones, Sun } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'H / Click Horn Button', desc: 'Blow Truck Horn (Plays YouTube Horn Sound)', icon: <Volume2 className="w-4 h-4 text-amber-400" /> },
    { key: 'Space / K', desc: 'Play or Pause Music', icon: <Disc className="w-4 h-4 text-emerald-400" /> },
    { key: '← / →', desc: 'Previous / Next Track in Highway Playlist', icon: <Disc className="w-4 h-4 text-blue-400" /> },
    { key: 'B', desc: 'Toggle Background Environment (Night 🌙 → Day ☀️ → Winter ❄️)', icon: <Sun className="w-4 h-4 text-amber-300" /> },
    { key: 'W', desc: 'Trigger Windshield Wiper (Clears Rain Drops)', icon: <CloudRain className="w-4 h-4 text-cyan-400" /> },
    { key: 'R', desc: 'Toggle Rain & Cycle Intensity (OFF → Light → Medium → Heavy)', icon: <CloudRain className="w-4 h-4 text-indigo-400" /> },
    { key: 'E', desc: 'Earphone Mode (Mutes Rain Sound, Keeps Rain Visuals)', icon: <Headphones className="w-4 h-4 text-purple-400" /> },
    { key: 'S', desc: 'Rotate Next Indian Truck Shayari', icon: <Sparkles className="w-4 h-4 text-amber-300" /> },
    { key: 'M', desc: 'Mute / Unmute Audio', icon: <Volume2 className="w-4 h-4 text-rose-400" /> },
    { key: '?', desc: 'Toggle Keyboard Shortcuts Menu', icon: <Keyboard className="w-4 h-4 text-purple-400" /> }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/20 shadow-2xl relative"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white tracking-wide">Interactive Shortcuts</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {shortcuts.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2.5">
                  {s.icon}
                  <span className="text-xs text-slate-200">{s.desc}</span>
                </div>
                <kbd className="px-2 py-1 text-[11px] font-mono bg-black/50 text-amber-300 border border-amber-500/30 rounded shadow-sm">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-5 text-center text-xs text-slate-400 italic">
            Press any shortcut key on your keyboard anytime to interact! 🚛🌧️
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
