'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VideoTile } from '@/components/VideoTile';
import { MonitorUp } from 'lucide-react';

export interface StageTile {
  peerId: string;
  name: string;
  role: string;
  stream: MediaStream | null;
  isLocal: boolean;
  handRaised?: boolean;
  sticker?: string | null;
}

export interface Presentation {
  peerId: string;
  name: string;
  stream: MediaStream;
}

interface VideoStageProps {
  tiles: StageTile[];
  presentation: Presentation | null;
  ownPeerId: string;
  maximizedPeerId: string | null;
  onMaximize: (peerId: string | null) => void;
}

function PresentationView({ presentation }: { presentation: Presentation }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !presentation.stream) return;
    el.srcObject = presentation.stream;
    el.play().catch(() => {});
  }, [presentation.stream]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-contain bg-black"
      />
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full">
        <MonitorUp className="w-3.5 h-3.5" />
        {presentation.name} is presenting
      </div>
    </>
  );
}

function TileWrapper({
  tile,
  className,
  maximized,
  onMaximize,
}: {
  tile: StageTile;
  className?: string;
  maximized?: boolean;
  onMaximize: (peerId: string | null) => void;
}) {
  return (
    <div className={cn('relative min-h-0 min-w-0', className)}>
      <VideoTile
        stream={tile.stream}
        name={tile.name}
        role={tile.role}
        isLocal={tile.isLocal}
        handRaised={tile.handRaised}
        sticker={tile.sticker}
        maximized={maximized}
        onToggleMaximize={() => onMaximize(maximized ? null : tile.peerId)}
      />
    </div>
  );
}

export function VideoStage({
  tiles,
  presentation,
  ownPeerId,
  maximizedPeerId,
  onMaximize,
}: VideoStageProps) {
  const localTile = tiles.find((t) => t.isLocal) || tiles.find((t) => t.peerId === ownPeerId);
  const remoteTiles = tiles.filter((t) => !t.isLocal && t.peerId !== ownPeerId);
  const count = tiles.length;

  if (maximizedPeerId) {
    const tile = tiles.find((t) => t.peerId === maximizedPeerId);
    if (tile) {
      return (
        <div className="h-full w-full p-2">
          <TileWrapper tile={tile} className="h-full" maximized onMaximize={onMaximize} />
        </div>
      );
    }
  }

  if (presentation) {
    return (
      <div className="h-full w-full flex gap-2 p-2 min-h-0">
        <div className="flex-[3] min-w-0 min-h-0 relative rounded-2xl overflow-hidden bg-slate-900 shadow-md ring-1 ring-slate-200/60">
          <PresentationView presentation={presentation} />
        </div>
        <div className="flex-[1] min-w-0 flex flex-col gap-2 overflow-y-auto min-h-0">
          {tiles.map((tile) => (
            <TileWrapper
              key={tile.peerId}
              tile={tile}
              className="w-full aspect-video shrink-0"
              onMaximize={onMaximize}
            />
          ))}
        </div>
      </div>
    );
  }

  if (count <= 1 && localTile) {
    return (
      <div className="h-full w-full p-2 flex items-center justify-center">
        <TileWrapper tile={localTile} className="w-full max-w-4xl aspect-video" onMaximize={onMaximize} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="h-full w-full grid grid-cols-2 gap-2 p-2 min-h-0">
        {tiles.map((tile) => (
          <TileWrapper key={tile.peerId} tile={tile} className="h-full min-h-[200px]" onMaximize={onMaximize} />
        ))}
      </div>
    );
  }

  if (count === 3 && localTile) {
    return (
      <div className="h-full w-full grid grid-cols-2 gap-2 p-2 min-h-0">
        <TileWrapper tile={localTile} className="h-full min-h-[240px]" onMaximize={onMaximize} />
        <div className="flex flex-col gap-2 min-h-0 h-full">
          {remoteTiles.map((tile) => (
            <TileWrapper key={tile.peerId} tile={tile} className="flex-1 min-h-0" onMaximize={onMaximize} />
          ))}
        </div>
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="h-full w-full grid grid-rows-2 gap-2 p-2 min-h-0">
        <TileWrapper tile={tiles[0]} className="h-full" onMaximize={onMaximize} />
        <div className="grid grid-cols-2 gap-2 min-h-0">
          {tiles.slice(1).map((tile) => (
            <TileWrapper key={tile.peerId} tile={tile} className="h-full" onMaximize={onMaximize} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0">
      {tiles.slice(0, 4).map((tile) => (
        <TileWrapper key={tile.peerId} tile={tile} className="h-full min-h-[160px]" onMaximize={onMaximize} />
      ))}
      {tiles.length > 4 && (
        <div className="col-span-2 text-center text-sm text-slate-500 py-1">
          +{tiles.length - 4} more participants
        </div>
      )}
    </div>
  );
}
