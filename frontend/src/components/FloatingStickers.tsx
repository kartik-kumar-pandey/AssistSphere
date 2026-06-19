'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface FloatingStickerItem {
  id: string;
  emoji: string;
  name: string;
  streamKey: string;
  trailIndex: number;
  originSide: 'left' | 'right';
}

interface FloatingStickersProps {
  items: FloatingStickerItem[];
  onDone: (id: string) => void;
}

const streamTrailCounters = new Map<string, number>();
const streamLastAt = new Map<string, number>();

function FloatingSticker({ item, onDone }: { item: FloatingStickerItem; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 6200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const originLeft = item.originSide === 'left' ? '18%' : '78%';
  const delayMs = item.trailIndex * 240;

  return (
    <div
      className={cn(
        'absolute bottom-20 pointer-events-none',
        item.originSide === 'left' ? 'sticker-snake-left' : 'sticker-snake-right'
      )}
      style={{ left: originLeft, animationDelay: `${delayMs}ms` }}
    >
      <div className="flex flex-col items-center gap-1 sticker-snake-body">
        <span className="text-4xl md:text-5xl drop-shadow-2xl sticker-snake-emoji">{item.emoji}</span>
        <span className="sticker-name-badge px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap">
          {item.name}
        </span>
      </div>
    </div>
  );
}

export function FloatingStickers({ items, onDone }: FloatingStickersProps) {
  if (items.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-30">
      {items.map((item) => (
        <FloatingSticker key={item.id} item={item} onDone={() => onDone(item.id)} />
      ))}
    </div>
  );
}

export function createFloatingSticker(
  name: string,
  emoji: string,
  options: { streamKey: string; isLocal: boolean }
): FloatingStickerItem {
  const now = Date.now();
  const lastAt = streamLastAt.get(options.streamKey) ?? 0;
  let trailIndex = 0;

  if (now - lastAt < 2800) {
    trailIndex = (streamTrailCounters.get(options.streamKey) ?? 0) + 1;
  } else {
    trailIndex = 0;
  }

  streamTrailCounters.set(options.streamKey, trailIndex);
  streamLastAt.set(options.streamKey, now);

  window.setTimeout(() => {
    const current = streamTrailCounters.get(options.streamKey) ?? 0;
    if (current > 0) streamTrailCounters.set(options.streamKey, current - 1);
  }, 6500);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    emoji,
    name,
    streamKey: options.streamKey,
    trailIndex,
    originSide: options.isLocal ? 'left' : 'right',
  };
}
