'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

function VideoTile({
  stream,
  name,
  role,
  muted,
  isLocal,
}: {
  stream: MediaStream | null;
  name: string;
  role: string;
  muted?: boolean;
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    if (videoEl && videoTrack) {
      videoEl.srcObject = new MediaStream([videoTrack]);
      videoEl.play().catch(() => {});

      const refresh = () => forceUpdate((n) => n + 1);
      videoTrack.addEventListener('unmute', refresh);
      videoTrack.addEventListener('mute', refresh);
      return () => {
        videoTrack.removeEventListener('unmute', refresh);
        videoTrack.removeEventListener('mute', refresh);
      };
    }

    if (audioEl && audioTrack && !isLocal) {
      audioEl.srcObject = new MediaStream([audioTrack]);
      audioEl.play().catch(() => {});
    }
  }, [stream, isLocal]);

  const videoTrack = stream?.getVideoTracks()[0];
  const showVideo = !!videoTrack;

  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10 group">
      {!isLocal && stream?.getAudioTracks()[0] && (
        <audio ref={audioRef} autoPlay playsInline />
      )}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover bg-slate-900"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="w-20 h-20 rounded-full bg-indigo-600/30 flex items-center justify-center text-2xl font-bold text-indigo-300">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {name} {isLocal && '(You)'}
          </span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            role === 'AGENT' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-emerald-500/30 text-emerald-300'
          )}>
            {role === 'AGENT' ? 'Agent' : 'Customer'}
          </span>
        </div>
      </div>
    </div>
  );
}

export { VideoTile };
