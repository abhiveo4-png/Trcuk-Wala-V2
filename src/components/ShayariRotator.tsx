import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCw, Copy, Check } from 'lucide-react';
import { TRUCK_SHAYARI_LIST } from '../data/songsAndShayari';

export const ShayariRotator: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TRUCK_SHAYARI_LIST.length);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % TRUCK_SHAYARI_LIST.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + TRUCK_SHAYARI_LIST.length) % TRUCK_SHAYARI_LIST.length);
  };

  const handleRandom = () => {
    let nextIdx = Math.floor(Math.random() * TRUCK_SHAYARI_LIST.length);
    if (nextIdx === currentIndex) {
      nextIdx = (nextIdx + 1) % TRUCK_SHAYARI_LIST.length;
    }
    setCurrentIndex(nextIdx);
  };

  const currentShayari = TRUCK_SHAYARI_LIST[currentIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentShayari.hindiText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-20 max-w-2xl mx-auto px-4 text-center my-4">
      <div className="relative inline-flex items-center justify-center group">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentShayari.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="flex flex-col items-center"
          >
            {/* Hindi Slogan in bold Devanagari */}
            <p className="font-devanagari text-xl sm:text-2xl md:text-3xl font-medium tracking-wide text-amber-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] leading-relaxed">
              "{currentShayari.hindiText}"
            </p>

            {/* Transliteration subtext */}
            {currentShayari.englishSub && (
              <p className="text-xs sm:text-sm font-sans tracking-wider text-slate-300/80 mt-1 italic font-light">
                {currentShayari.englishSub}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mini control bar */}
      <div className="flex items-center justify-center gap-2 mt-3 text-slate-300/60">
        <button
          onClick={handlePrev}
          title="Previous Shayari"
          className="p-1.5 rounded-full hover:bg-white/10 hover:text-white transition-all active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-amber-200/90">
          {currentIndex + 1} / {TRUCK_SHAYARI_LIST.length}
        </span>

        <button
          onClick={handleNext}
          title="Next Shayari"
          className="p-1.5 rounded-full hover:bg-white/10 hover:text-white transition-all active:scale-95 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={handleRandom}
          title="Random Shayari (Key: S)"
          className="p-1.5 rounded-full hover:bg-white/10 hover:text-amber-300 transition-all active:scale-95 cursor-pointer ml-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleCopy}
          title="Copy Shayari"
          className="p-1.5 rounded-full hover:bg-white/10 hover:text-amber-300 transition-all active:scale-95 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
