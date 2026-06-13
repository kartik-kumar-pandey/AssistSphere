'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

function VideoTile({
  stream,
  name,
  role,
  isLocal,
}: {
  stream: MediaStream | null;
  name: string;
  role: string;
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!stream) {
      setHasVideo(false);
      return;
    }

    const unmuteCleanups: (() => void)[] = [];

    const attachMedia = () => {
      const videoTrack = stream.getVideoTracks()[0];
      setHasVideo(Boolean(videoTrack));

      if (videoEl) {
        if (videoTrack) {
          const videoStream = new MediaStream([videoTrack]);
          videoEl.srcObject = videoStream;
          videoEl
            .play()
            .then(() => setNeedsInteraction(false))
            .catch((err) => {
              console.warn('[VideoTile] video play failed:', err);
              setNeedsInteraction(true);
            });

          const onUnmute = () => {
            videoEl.play().catch(() => {});
          };
          videoTrack.addEventListener('unmute', onUnmute);
          unmuteCleanups.push(() => videoTrack.removeEventListener('unmute', onUnmute));
        } else {
          videoEl.srcObject = null;
        }
      }

      if (audioEl && !isLocal) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioEl.srcObject = new MediaStream([audioTrack]);
          audioEl.play().catch((err) => console.warn('[VideoTile] audio play failed:', err));
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
      unmuteCleanups.forEach((fn) => fn());
    };
  }, [stream, isLocal]);

  const handleUnlock = () => {
    videoRef.current?.play().catch(() => {});
    audioRef.current?.play().catch(() => {});
    setNeedsInteraction(false);
  };

  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10 group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          'w-full h-full object-cover bg-slate-900',
          hasVideo ? 'block' : 'hidden'
        )}
      />
      {!isLocal && <audio ref={audioRef} autoPlay playsInline className="hidden" />}
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="w-20 h-20 rounded-full bg-indigo-600/30 flex items-center justify-center text-2xl font-bold text-indigo-300">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      {needsInteraction && !isLocal && hasVideo && (
        <button
          type="button"
          onClick={handleUnlock}
          className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm font-medium hover:bg-black/70 z-10"
        >
          Click to play video
        </button>
      )}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {name} {isLocal && '(You)'}
          </span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              role === 'AGENT'
                ? 'bg-indigo-500/30 text-indigo-300'
                : 'bg-emerald-500/30 text-emerald-300'
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
