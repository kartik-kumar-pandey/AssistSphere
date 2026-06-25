'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { VideoTile } from '@/components/VideoTile';
import { MonitorUp, MousePointer, PenTool, Trash } from 'lucide-react';

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
  socket?: any;
  role?: 'AGENT' | 'CUSTOMER';
}

function PresentationView({
  presentation,
  socket,
  role
}: {
  presentation: Presentation;
  socket?: any;
  role?: 'AGENT' | 'CUSTOMER';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);

  const [activeMode, setActiveMode] = useState<'pointer' | 'draw'>('pointer');
  const [drawColor, setDrawColor] = useState('#ef4444'); // default red
  const [ripples, setRipples] = useState<{ id: string; x: number; y: number }[]>([]);

  // Video feed bindings
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !presentation.stream) return;
    el.srcObject = presentation.stream;
    el.play().catch(() => {});
  }, [presentation.stream]);

  // Pointer click ripple receiver
  useEffect(() => {
    if (!socket) return;
    const handlePointerClick = (data: { peerId: string; x: number; y: number }) => {
      const id = `${Date.now()}-${Math.random()}`;
      setRipples((prev) => [...prev, { id, x: data.x, y: data.y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
    };

    socket.on('peer:pointer:click', handlePointerClick);
    return () => {
      socket.off('peer:pointer:click', handlePointerClick);
    };
  }, [socket]);

  // Canvas size adjustment
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeCanvas = () => {
      // Keep canvas resolution in sync with display size
      const ctx = canvas.getContext('2d');
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx && ctx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      if (ctx) {
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Periodically sync size in case presentation element changes size dynamically
    const interval = setInterval(resizeCanvas, 1000);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(interval);
    };
  }, [presentation]);

  // Drawing helper
  const drawLine = (fromX: number, fromY: number, toX: number, toY: number, color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(fromX * canvas.width, fromY * canvas.height);
    ctx.lineTo(toX * canvas.width, toY * canvas.height);
    ctx.stroke();
  };

  // Drawing stroke receiver
  useEffect(() => {
    if (!socket) return;
    const handleDraw = (data: { type: 'draw' | 'clear'; fromX?: number; fromY?: number; toX?: number; toY?: number; color?: string }) => {
      if (data.type === 'clear') {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      } else if (data.type === 'draw' && data.fromX !== undefined && data.fromY !== undefined && data.toX !== undefined && data.toY !== undefined) {
        drawLine(data.fromX, data.fromY, data.toX, data.toY, data.color || '#ef4444');
      }
    };

    socket.on('peer:annotation:draw', handleDraw);
    return () => {
      socket.off('peer:annotation:draw', handleDraw);
    };
  }, [socket]);

  // Mouse / Drawing triggers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeMode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    isDrawingRef.current = true;
    lastXRef.current = (e.clientX - rect.left) / rect.width;
    lastYRef.current = (e.clientY - rect.top) / rect.height;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (isDrawingRef.current && activeMode === 'draw') {
      const currentX = (e.clientX - rect.left) / rect.width;
      const currentY = (e.clientY - rect.top) / rect.height;

      drawLine(lastXRef.current, lastYRef.current, currentX, currentY, drawColor);

      socket?.emit('annotation:draw', {
        type: 'draw',
        fromX: lastXRef.current,
        fromY: lastYRef.current,
        toX: currentX,
        toY: currentY,
        color: drawColor
      });

      lastXRef.current = currentX;
      lastYRef.current = currentY;
    }
  };

  const handleMouseUpOrLeave = () => {
    isDrawingRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeMode !== 'pointer') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const id = `${Date.now()}-${Math.random()}`;
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 3000);

    socket?.emit('pointer:click', { x, y });
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    socket?.emit('annotation:draw', { type: 'clear' });
  };

  return (
    <>
      <style>{`
        @keyframes pointer-ripple {
          0% { transform: scale(0.3); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-contain bg-black"
      />

      {/* Floating ripples layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
        {ripples.map((r) => (
          <div
            key={r.id}
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-4 border-indigo-500 pointer-events-none z-20"
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              animation: 'pointer-ripple 1.5s ease-out infinite',
            }}
          />
        ))}
      </div>

      {/* Interactive canvas overlay */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onClick={handleCanvasClick}
        className={cn(
          "absolute inset-0 w-full h-full z-10",
          activeMode === 'draw' ? 'cursor-crosshair' : 'cursor-pointer'
        )}
      />

      {/* Toolbar overlay */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-slate-700 shadow-xl z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => setActiveMode('pointer')}
          className={cn(
            "p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-slate-800 transition-colors",
            activeMode === 'pointer' && "bg-indigo-600 hover:bg-indigo-700 text-white"
          )}
          title="Pointer Mode"
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('draw')}
          className={cn(
            "p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-slate-800 transition-colors",
            activeMode === 'draw' && "bg-indigo-600 hover:bg-indigo-700 text-white"
          )}
          title="Drawing Mode"
        >
          <PenTool className="w-4 h-4" />
        </button>
        {activeMode === 'draw' && (
          <div className="flex gap-1 border-l border-slate-700 pl-1.5 mr-1">
            {['#ef4444', '#10b981', '#3b82f6'].map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setDrawColor(color)}
                className={cn(
                  "w-3.5 h-3.5 rounded-full border border-white/20 transition-transform",
                  drawColor === color && "scale-125 border-white"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={handleClear}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-slate-800 transition-colors border-l border-slate-700 pl-1.5"
          title="Clear Drawings"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full z-20">
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
  socket,
  role
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
      <div className="h-full w-full flex flex-col sm:flex-row gap-2 p-2 min-h-0">
        <div className="flex-[3] min-w-0 min-h-[280px] sm:min-h-0 relative rounded-2xl overflow-hidden bg-slate-900 shadow-md ring-1 ring-slate-200/60">
          <PresentationView presentation={presentation} socket={socket} role={role} />
        </div>
        <div className="w-full sm:w-1/4 sm:flex-[1] min-w-0 flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto min-h-0 h-28 sm:h-auto shrink-0">
          {tiles.map((tile) => (
            <TileWrapper
              key={tile.peerId}
              tile={tile}
              className="w-36 sm:w-full aspect-video shrink-0"
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
      <div className="h-full w-full grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 min-h-0 overflow-y-auto sm:overflow-visible">
        {tiles.map((tile) => (
          <TileWrapper key={tile.peerId} tile={tile} className="h-full min-h-[180px] sm:min-h-[200px]" onMaximize={onMaximize} />
        ))}
      </div>
    );
  }

  if (count === 3 && localTile) {
    return (
      <div className="h-full w-full grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 min-h-0 overflow-y-auto sm:overflow-visible">
        <TileWrapper tile={localTile} className="h-full min-h-[200px] sm:min-h-[240px] sm:col-span-2" onMaximize={onMaximize} />
        {remoteTiles.map((tile) => (
          <TileWrapper key={tile.peerId} tile={tile} className="h-full min-h-[180px]" onMaximize={onMaximize} />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="h-full w-full grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 min-h-0 overflow-y-auto sm:overflow-visible">
        {tiles.map((tile, i) => (
          <TileWrapper
            key={tile.peerId}
            tile={tile}
            className={cn("h-full min-h-[180px]", i === 0 && "sm:col-span-2")}
            onMaximize={onMaximize}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full w-full grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 min-h-0 overflow-y-auto">
      {tiles.slice(0, 4).map((tile) => (
        <TileWrapper key={tile.peerId} tile={tile} className="h-full min-h-[160px]" onMaximize={onMaximize} />
      ))}
      {tiles.length > 4 && (
        <div className="col-span-1 sm:col-span-2 text-center text-sm text-slate-500 py-1">
          +{tiles.length - 4} more participants
        </div>
      )}
    </div>
  );
}
