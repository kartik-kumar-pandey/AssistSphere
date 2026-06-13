'use client';

import { useState, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare,
  Circle, Square, Paperclip, Send, X, Users, Wifi, WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, API_URL, apiFetch } from '@/lib/utils';
import { useMediasoup } from '@/hooks/useMediasoup';
import { useChat } from '@/hooks/useChat';
import { VideoTile } from '@/components/VideoTile';

interface CallRoomProps {
  sessionId: string;
  token: string;
  name: string;
  role: 'AGENT' | 'CUSTOMER';
  onLeave: () => void;
}

export function CallRoom({ sessionId, token, name, role, onLeave }: CallRoomProps) {
  const [chatOpen, setChatOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState<{ id: string; status: string } | null>(null);
  const [sessionEnded, setSessionEnded] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connectionError, setConnectionError] = useState('');

  const {
    connected,
    mediaReady,
    localStream,
    remoteStreams,
    peers,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    endSession,
    startRecording,
    stopRecording,
    leave,
    socket,
  } = useMediasoup({
    token,
    onSessionEnded: (reason) => setSessionEnded(reason),
    onRecordingStatus: (status) => {
      setRecording({ id: status.recordingId || '', status: status.status });
    },
    onError: (msg) => {
      console.error(msg);
      setConnectionError(msg);
    },
  });

  const { messages, sendMessage, uploadFile, sending, bottomRef } = useChat(
    socket,
    sessionId,
    token
  );

  async function handleEndCall() {
    try {
      if (role === 'AGENT') {
        try {
          await endSession();
        } catch {
          await apiFetch(`/sessions/${sessionId}/end`, { method: 'POST' }, token);
        }
      }
    } catch (err) {
      console.error('End call error:', err);
    } finally {
      leave();
      onLeave();
    }
  }

  async function handleLeave() {
    try {
      leave();
    } finally {
      onLeave();
    }
  }

  async function toggleRecording() {
    if (!recording || recording.status !== 'IN_PROGRESS') {
      const result = await startRecording();
      setRecording({ id: result.recording.id, status: 'IN_PROGRESS' });
    } else {
      await stopRecording(recording.id);
    }
  }

  if (connectionError && !mediaReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="text-center glass rounded-2xl p-10 max-w-md">
          <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
          <p className="text-slate-400 mb-6">{connectionError}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.reload()}>Retry</Button>
            <Button variant="secondary" onClick={onLeave}>Go Home</Button>
          </div>
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center glass rounded-2xl p-10 max-w-md">
          <PhoneOff className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Call Ended</h2>
          <p className="text-slate-400 mb-6">{sessionEnded}</p>
          <Button onClick={onLeave}>Return Home</Button>
        </div>
      </div>
    );
  }

  const remotePeerIds = new Set([
    ...peers.map((p) => p.id),
    ...remoteStreams.map((r) => r.peerId),
  ]);
  const participantCount = 1 + remotePeerIds.size;

  const allStreams = [
    { peerId: 'local', name, role, stream: localStream, isLocal: true },
    ...remoteStreams.map((r) => ({
      peerId: r.peerId,
      name: r.name,
      role: peers.find((p) => p.id === r.peerId)?.role || 'REMOTE',
      stream: r.stream,
      isLocal: false,
    })),
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 glass">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
            )}
            <span className="text-sm text-slate-400">
              {mediaReady ? 'Connected' : connected ? 'Setting up media...' : 'Connecting...'}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Users className="w-4 h-4" />
            {participantCount} participant{participantCount !== 1 ? 's' : ''}
          </div>
          {recording?.status === 'IN_PROGRESS' && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
              <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
              Recording
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500 font-mono">Session: {sessionId.slice(0, 8)}...</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className={cn('flex-1 p-4 flex flex-col', chatOpen ? 'lg:mr-0' : '')}>
          <div className={cn(
            'flex-1 grid gap-4',
            allStreams.length <= 1
              ? 'grid-cols-1 max-w-2xl mx-auto w-full'
              : 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto w-full'
          )}>
            {allStreams.map((s) => (
              <VideoTile
                key={s.peerId}
                stream={s.stream}
                name={s.name}
                role={s.role}
                isLocal={s.isLocal}
              />
            ))}
          </div>
          {remoteStreams.length === 0 && peers.length > 0 && (
            <p className="text-center text-slate-500 text-sm mt-2">Waiting for video from other participant...</p>
          )}
          {remoteStreams.length === 0 && peers.length === 0 && (
            <p className="text-center text-slate-500 text-sm mt-2">Waiting for other participant to join...</p>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-full lg:w-96 border-l border-white/5 flex flex-col glass">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h3 className="font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Chat
              </h3>
              <button onClick={() => setChatOpen(false)} className="lg:hidden p-1 hover:bg-white/5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                    msg.senderName === name
                      ? 'ml-auto bg-indigo-600/30 text-indigo-100'
                      : 'bg-white/5 text-slate-300'
                  )}
                >
                  <p className="text-xs text-slate-500 mb-1">{msg.senderName}</p>
                  <p>{msg.text}</p>
                  {msg.fileUrl && (
                    <a
                      href={`${API_URL.replace('/api', '')}${msg.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 underline text-xs mt-1 block"
                    >
                      {msg.fileName || 'Download file'}
                    </a>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-white/5">
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(message);
                      setMessage('');
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
                <button
                  onClick={() => { sendMessage(message); setMessage(''); }}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <footer className="flex items-center justify-center gap-3 px-4 py-4 border-t border-white/5 glass">
        <Button
          variant={audioEnabled ? 'secondary' : 'danger'}
          size="md"
          onClick={toggleAudio}
          className="rounded-full !p-3"
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        <Button
          variant={videoEnabled ? 'secondary' : 'danger'}
          size="md"
          onClick={toggleVideo}
          className="rounded-full !p-3"
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>

        {!chatOpen && (
          <Button variant="secondary" size="md" onClick={() => setChatOpen(true)} className="rounded-full !p-3">
            <MessageSquare className="w-5 h-5" />
          </Button>
        )}

        {role === 'AGENT' && (
          <Button
            variant={recording?.status === 'IN_PROGRESS' ? 'danger' : 'secondary'}
            size="md"
            onClick={toggleRecording}
            className="rounded-full !p-3"
          >
            {recording?.status === 'IN_PROGRESS' ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </Button>
        )}

        {role === 'AGENT' ? (
          <Button variant="danger" size="md" onClick={handleEndCall} className="rounded-full !px-6">
            <PhoneOff className="w-5 h-5" />
            End Call
          </Button>
        ) : (
          <Button variant="danger" size="md" onClick={handleLeave} className="rounded-full !px-6">
            <PhoneOff className="w-5 h-5" />
            Leave
          </Button>
        )}
      </footer>
    </div>
  );
}
