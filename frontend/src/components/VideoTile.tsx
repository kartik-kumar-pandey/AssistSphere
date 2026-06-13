'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Hand, Maximize2, Minimize2 } from 'lucide-react';

function VideoTile({
  stream,
  name,
  role,
  isLocal,
  handRaised,
  sticker,
  maximized,
  onToggleMaximize,
}: {
  stream: MediaStream | null;
  name: string;
  role: string;
  isLocal?: boolean;
  handRaised?: boolean;
  sticker?: string | null;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!stream) {
      setHasVideo(false);
      return;
    }

    const cleanups: (() => void)[] = [];
    let rafId: number;

    const attachMedia = () => {
      const videoTrack = stream.getVideoTracks()[0];

      if (videoEl) {
        if (videoTrack && videoTrack.readyState !== 'ended') {
          videoEl.srcObject = new MediaStream([videoTrack]);
          videoEl.play().catch(() => setNeedsInteraction(true));

          // Poll via rAF until the video element actually has frames
          cancelAnimationFrame(rafId);
          const checkVideo = () => {
            // readyState >= 2 means HAVE_CURRENT_DATA (actual frames available)
            if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
              setHasVideo(true);
            } else {
              rafId = requestAnimationFrame(checkVideo);
            }
          };
          rafId = requestAnimationFrame(checkVideo);
          cleanups.push(() => cancelAnimationFrame(rafId));

          // Also catch the 'playing' event as a fast-path
          const onPlaying = () => setHasVideo(true);
          videoEl.addEventListener('playing', onPlaying);
          cleanups.push(() => videoEl.removeEventListener('playing', onPlaying));

          // Resume when track unmutes
          const onUnmute = () => {
            videoEl.play().catch(() => {});
            setHasVideo(true);
          };
          videoTrack.addEventListener('unmute', onUnmute);
          cleanups.push(() => videoTrack.removeEventListener('unmute', onUnmute));
        } else {
          videoEl.srcObject = null;
          setHasVideo(false);
        }
      }

      if (audioEl && !isLocal) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioEl.srcObject = new MediaStream([audioTrack]);
          audioEl.play().catch(() => {});
        } else {
          audioEl.srcObject = null;
        }
      }
    };

    attachMedia();
    stream.addEventListener('addtrack', attachMedia);
    stream.addEventListener('removetrack', attachMedia);

    return () => {
      stream.removeEventListener('addtrack', attachMedia);
      stream.removeEventListener('removetrack', attachMedia);
      cleanups.forEach((fn) => fn());
    };
  }, [stream, isLocal]);

  function handleFullscreen() {
    if (onToggleMaximize) {
      onToggleMaximize();
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[120px] rounded-2xl overflow-hidden bg-slate-900 shadow-md ring-1 ring-slate-200/60"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          'absolute inset-0 w-full h-full object-cover',
          !hasVideo && 'opacity-0 pointer-events-none'
        )}
      />
      {!isLocal && <audio ref={audioRef} autoPlay playsInline className="hidden" />}

      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
          <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center text-xl font-bold text-indigo-600">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {needsInteraction && !isLocal && hasVideo && (
        <button
          type="button"
          onClick={() => {
            videoRef.current?.play().catch(() => {});
            setNeedsInteraction(false);
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-medium z-10"
        >
          Tap to play video
        </button>
      )}

      <button
        type="button"
        onClick={handleFullscreen}
        className="absolute top-2 left-2 z-20 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
        title={maximized ? 'Exit maximize' : 'Maximize'}
      >
        {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      {sticker && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce z-20 pointer-events-none drop-shadow-lg">
          {sticker}
        </div>
      )}

      {handRaised && (
        <div className="absolute top-3 right-3 z-20 bg-amber-400 text-amber-950 rounded-full p-2 shadow-lg animate-pulse">
          <Hand className="w-5 h-5" />
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 px-3 py-2.5 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white drop-shadow-sm truncate">
            {name}
            {isLocal && <span className="text-white/70 font-normal"> · You</span>}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md shrink-0',
              role === 'AGENT'
                ? 'bg-indigo-500/90 text-white'
                : 'bg-emerald-500/90 text-white'
            )}
          >
            {role === 'AGENT' ? 'Agent' : 'Customer'}
          </span>
        </div>
      </div>
    </div>
  );
}

export { VideoTile };
