'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FloatingStickerItem {
  id: string;
  emoji: string;
  name: string;
  streamKey: string;
  trailIndex: number;
  originSide: 'left' | 'right';
  randomX: number;
  randomRotate: number;
  randomDuration: number;
}

interface FloatingStickersProps {
  items: FloatingStickerItem[];
  onDone: (id: string) => void;
}

function FloatingSticker({ item, onDone }: { item: FloatingStickerItem; onDone: () => void }) {
  useEffect(() => {
    // Keep a small buffer before removing to ensure animation completes smoothly
    const timer = window.setTimeout(onDone, item.randomDuration * 1000 + 100);
    return () => window.clearTimeout(timer);
  }, [onDone, item.randomDuration]);

  // Place floating reactions in the bottom-middle areas of the call stage
  const originLeft = item.originSide === 'left' ? '25%' : '75%';

  return (
    <motion.div
      initial={{
        x: 0,
        y: 0,
        opacity: 0,
        scale: 0.5,
        rotate: 0,
      }}
      animate={{
        x: item.randomX,
        y: -350,
        opacity: [0, 1, 1, 0], // Fades in quickly, stays bright, then fades out
        scale: [0.5, 1.2, 1.2, 0.8],
        rotate: [0, item.randomRotate * 0.5, item.randomRotate],
      }}
      transition={{
        duration: item.randomDuration,
        ease: 'easeOut',
        times: [0, 0.15, 0.75, 1],
      }}
      className="absolute bottom-20 pointer-events-none z-30"
      style={{ left: originLeft }}
    >
      <div className="flex flex-col items-center gap-1.5 filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
        <span className="text-5xl md:text-6xl select-none leading-none">{item.emoji}</span>
        <span className="bg-gradient-to-r from-indigo-500/90 to-purple-600/90 backdrop-blur-md text-[10px] font-bold text-white px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-lg border border-white/20">
          {item.name}
        </span>
      </div>
    </motion.div>
  );
}

export function FloatingStickers({ items, onDone }: FloatingStickersProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-30">
      <AnimatePresence>
        {items.map((item) => (
          <FloatingSticker key={item.id} item={item} onDone={() => onDone(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function createFloatingSticker(
  name: string,
  emoji: string,
  options: { streamKey: string; isLocal: boolean }
): FloatingStickerItem {
  const now = Date.now();
  
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    emoji,
    name,
    streamKey: options.streamKey,
    trailIndex: 0,
    originSide: options.isLocal ? 'left' : 'right',
    randomX: (Math.random() - 0.5) * 120, // drift between -60px and +60px
    randomRotate: (Math.random() - 0.5) * 30, // tilt between -15deg and +15deg
    randomDuration: 2.0 + Math.random() * 0.5, // 2.0s to 2.5s duration
  };
}
