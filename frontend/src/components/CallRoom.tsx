'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare,
  Circle, Square, Paperclip, Send, X, Users, Download, Loader2,
  ChevronLeft, Monitor, MonitorUp, Hand, Smile, UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn, API_URL, apiFetch } from '@/lib/utils';
import { useMediasoup } from '@/hooks/useMediasoup';
import { useClientRecording } from '@/hooks/useClientRecording';
import { useChat } from '@/hooks/useChat';
import { VideoStage, type Presentation, type StageTile } from '@/components/VideoStage';

interface CallRoomProps {
  sessionId: string;
  token: string;
  name: string;
  role: 'AGENT' | 'CUSTOMER';
  onLeave: () => void;
}

export function CallRoom({ sessionId, token, name, role, onLeave }: CallRoomProps) {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(true);
  const [sideTab, setSideTab] = useState<'chat' | 'participants'>('chat');
  const [maximizedPeerId, setMaximizedPeerId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState<{ id: string; status: string } | null>(null);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const sessionEndedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connectionError, setConnectionError] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
  const [peerStickers, setPeerStickers] = useState<Record<string, string>>({});
  const [stickerOpen, setStickerOpen] = useState(false);
  const [kickingPeerId, setKickingPeerId] = useState<string | null>(null);

  const STICKERS = ['👍', '👏', '😂', '❤️', '🎉', '🙏', '✅', '🔥'];

  useEffect(() => {
    sessionEndedRef.current = sessionEnded;
  }, [sessionEnded]);

  function markSessionEnding() {
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setConnectionError('');
  }

  const {
    connected,
    mediaReady,
    localStream,
    localScreenStream,
    remoteStreams,
    peers,
    ownPeerId,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    screenSharing,
    endSession,
    startRecording,
    stopRecording,
    leave,
    kickPeer,
    socket,
  } = useMediasoup({
    token,
    onSessionEnded: () => {
      markSessionEnding();
      router.push(`/summary/${sessionId}`);
    },
    onKicked: () => {
      markSessionEnding();
      leave();
      router.push('/?kicked=1');
    },
    onRecordingStatus: (status) => {
      if (role === 'AGENT') {
        setRecording({ id: status.recordingId || '', status: status.status });
      } else if (status.status === 'IN_PROGRESS') {
        setRecording({ id: '', status: 'IN_PROGRESS' });
      } else {
        setRecording(null);
      }
    },
    onError: (msg) => {
      if (sessionEndedRef.current) return;
      console.error(msg);
      setConnectionError(msg);
    },
  });

  const { messages, sendMessage, uploadFile, sending, bottomRef } = useChat(
    socket,
    sessionId,
    token
  );

  const clientRecording = useClientRecording({
    token,
    localStream,
    localScreenStream,
    localName: name,
    remoteStreams,
    onStatusChange: (status, recordingId) => {
      if (role === 'AGENT') {
        setRecording({ id: recordingId || '', status });
      }
    },
    startRecordingSocket: startRecording,
    stopRecordingSocket: stopRecording,
  });

  useEffect(() => {
    if (!socket) return;

    const onRaiseHand = ({ peerId, raised }: { peerId: string; raised: boolean }) => {
      setRaisedHands((prev) => {
        const next = { ...prev };
        if (raised) next[peerId] = true;
        else delete next[peerId];
        return next;
      });
    };

    const onSticker = ({ peerId, emoji }: { peerId: string; emoji: string }) => {
      setPeerStickers((prev) => ({ ...prev, [peerId]: emoji }));
      setTimeout(() => {
        setPeerStickers((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }, 3000);
    };

    socket.on('peer:raiseHand', onRaiseHand);
    socket.on('peer:sticker', onSticker);
    return () => {
      socket.off('peer:raiseHand', onRaiseHand);
      socket.off('peer:sticker', onSticker);
    };
  }, [socket]);

  function toggleHand() {
    const next = !handRaised;
    setHandRaised(next);
    socket?.emit('raiseHand', { raised: next });
  }

  function sendSticker(emoji: string) {
    socket?.emit('sendSticker', { emoji });
    setStickerOpen(false);
    if (ownPeerId) {
      setPeerStickers((prev) => ({ ...prev, [ownPeerId]: emoji }));
      setTimeout(() => {
        setPeerStickers((prev) => {
          const next = { ...prev };
          delete next[ownPeerId];
          return next;
        });
      }, 3000);
    }
  }

  async function handleKickParticipant(targetPeerId: string, targetName: string) {
    if (role !== 'AGENT' || targetPeerId === ownPeerId) return;
    if (!confirm(`Remove ${targetName} from the call?`)) return;
    setKickingPeerId(targetPeerId);
    try {
      await kickPeer(targetPeerId);
    } catch (err) {
      console.error('Kick failed:', err);
    } finally {
      setKickingPeerId(null);
    }
  }

  async function handleEndCall() {
    markSessionEnding();
    try {
      if (recording?.status === 'IN_PROGRESS') {
        setRecordingBusy(true);
        await clientRecording.stop();
      }
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
      router.push(`/summary/${sessionId}`);
    }
  }

  async function handleLeave() {
    markSessionEnding();
    try {
      if (recording?.status === 'IN_PROGRESS' && role === 'AGENT') {
        await clientRecording.stop();
      }
      leave();
    } finally {
      onLeave();
    }
  }

  async function toggleRecording() {
    if (role !== 'AGENT') return;
    setRecordingBusy(true);
    try {
      if (!recording || recording.status !== 'IN_PROGRESS') {
        await clientRecording.start();
      } else {
        await clientRecording.stop();
      }
    } finally {
      setRecordingBusy(false);
    }
  }

  function downloadRecording() {
    if (!recording?.id) return;
    fetch(`${API_URL}/recordings/${recording.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${recording.id}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  if (connectionError && !sessionEnded && !sessionEndedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell p-6">
        <div className="card-elevated p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Could not connect media</h2>
          <p className="text-muted text-sm mb-6">{connectionError}</p>
          <p className="text-xs text-muted mb-6">
            For local testing, set <code className="bg-[var(--color-surface-muted)] px-1 rounded">MEDIASOUP_ANNOUNCED_IP=127.0.0.1</code> in backend .env and restart the server.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.reload()}>Retry</Button>
            <Button variant="secondary" onClick={onLeave}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }

  const remotePeerIds = new Set<string>();
  for (const p of peers) {
    if (p.id && p.id !== ownPeerId) remotePeerIds.add(p.id);
  }
  for (const r of remoteStreams) remotePeerIds.add(r.peerId);
  const participantCount = 1 + remotePeerIds.size;

  const waitingPeers = peers.filter((p) => p.id && p.id !== ownPeerId && !remoteStreams.some((r) => r.peerId === p.id));

  const cameraTiles: StageTile[] = [
    {
      peerId: ownPeerId || 'local',
      name,
      role,
      stream: localStream,
      isLocal: true,
      handRaised: handRaised,
      sticker: ownPeerId ? peerStickers[ownPeerId] || null : null,
    },
    ...remoteStreams.map((r) => ({
      peerId: r.peerId,
      name: r.name,
      role: peers.find((p) => p.id === r.peerId)?.role || 'CUSTOMER',
      stream: r.stream,
      isLocal: false,
      handRaised: raisedHands[r.peerId],
      sticker: peerStickers[r.peerId] || null,
    })),
  ];

  let presentation: Presentation | null = null;
  if (localScreenStream && screenSharing && ownPeerId) {
    presentation = { peerId: ownPeerId, name, stream: localScreenStream };
  } else {
    for (const r of remoteStreams) {
      if (r.screenStream && r.screenStream.getVideoTracks().length > 0) {
        presentation = { peerId: r.peerId, name: r.name, stream: r.screenStream };
        break;
      }
    }
  }

  const participantList = [
    { peerId: ownPeerId || 'local', name, role, isLocal: true, handRaised },
    ...peers
      .filter((p) => p.id && p.id !== ownPeerId)
      .map((p) => ({
        peerId: p.id,
        name: p.name,
        role: p.role,
        isLocal: false,
        handRaised: raisedHands[p.id] || false,
      })),
  ];

  return (
    <div className="h-screen flex flex-col page-shell">
      {/* Top bar */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleLeave}
            className="p-2 rounded-lg hover:bg-[var(--color-surface-muted)] text-muted hidden sm:flex"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-sm md:text-base truncate">
              Support Session
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  mediaReady ? 'text-emerald-600' : 'text-amber-600'
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    mediaReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  )}
                />
                {mediaReady ? 'Live' : 'Connecting…'}
              </span>
              <span>·</span>
              <Users className="w-3 h-3 inline" />
              {participantCount} in call
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {recording?.status === 'IN_PROGRESS' && role === 'AGENT' && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900/50">
              <Circle className="w-2 h-2 fill-red-500 animate-pulse" />
              Recording
            </span>
          )}
          {recording?.status === 'IN_PROGRESS' && role === 'CUSTOMER' && (
            <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <Circle className="w-2 h-2 fill-red-400" />
              Session being recorded
            </span>
          )}
          {recording?.status === 'READY' && role === 'AGENT' && (
            <button
              onClick={downloadRecording}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
          )}
          {recording?.status === 'PROCESSING' && role === 'AGENT' && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving…
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Video stage */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0">
            <VideoStage
              tiles={cameraTiles}
              presentation={presentation}
              ownPeerId={ownPeerId}
              maximizedPeerId={maximizedPeerId}
              onMaximize={setMaximizedPeerId}
            />
          </div>

          {remoteStreams.length === 0 && waitingPeers.length > 0 && (
            <p className="text-center text-slate-500 text-sm mt-6">
              Connecting video with {waitingPeers.map((p) => p.name).join(', ')}…
            </p>
          )}
          {remotePeerIds.size === 0 && (
            <p className="text-center text-slate-400 text-sm mt-6">
              Share the invite link — waiting for customer to join
            </p>
          )}

          {/* Floating controls over video area bottom */}
          <div className="mt-auto pt-6 flex flex-col items-center gap-2">
            {stickerOpen && (
              <div className="card-elevated rounded-2xl px-3 py-2 flex gap-1 shadow-lg">
                {STICKERS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => sendSticker(emoji)}
                    className="w-10 h-10 rounded-xl hover:bg-slate-100 text-xl transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <div className="card-elevated rounded-full px-2 py-2 flex items-center gap-1 shadow-xl">
              <ControlBtn active={audioEnabled} onClick={toggleAudio} off={!audioEnabled}>
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </ControlBtn>
              <ControlBtn active={videoEnabled && !screenSharing} onClick={toggleVideo} off={!videoEnabled && !screenSharing}>
                {videoEnabled || screenSharing ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </ControlBtn>
              <ControlBtn active={screenSharing} onClick={toggleScreenShare}>
                <MonitorUp className="w-5 h-5" />
              </ControlBtn>
              <ControlBtn active={handRaised} onClick={toggleHand}>
                <Hand className="w-5 h-5" />
              </ControlBtn>
              <ControlBtn active={stickerOpen} onClick={() => setStickerOpen((v) => !v)}>
                <Smile className="w-5 h-5" />
              </ControlBtn>
              {!chatOpen && (
                <ControlBtn onClick={() => setChatOpen(true)}>
                  <MessageSquare className="w-5 h-5" />
                </ControlBtn>
              )}
              {role === 'AGENT' && (
                <ControlBtn
                  onClick={toggleRecording}
                  danger={recording?.status === 'IN_PROGRESS'}
                  disabled={recordingBusy}
                >
                  {recordingBusy ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : recording?.status === 'IN_PROGRESS' ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </ControlBtn>
              )}
              <div className="w-px h-8 bg-slate-200 mx-1" />
              {role === 'AGENT' ? (
                <button
                  onClick={handleEndCall}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  End call
                </button>
              ) : (
                <button
                  onClick={handleLeave}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  Leave
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Chat sidebar */}
        {chatOpen && (
          <aside className="w-full sm:w-80 lg:w-96 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col shrink-0">
            <div className="flex border-b border-[var(--color-border)]">
              <button
                onClick={() => setSideTab('chat')}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2',
                  sideTab === 'chat'
                    ? 'text-indigo-600 border-b-2 border-indigo-500'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <MessageSquare className="w-4 h-4" />
                Messages
              </button>
              <button
                onClick={() => setSideTab('participants')}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2',
                  sideTab === 'participants'
                    ? 'text-indigo-600 border-b-2 border-indigo-500'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Users className="w-4 h-4" />
                People ({participantCount})
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="p-3 text-slate-400 hover:bg-slate-50 sm:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sideTab === 'participants' ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[var(--color-surface-muted)]/50">
                {participantList.map((p) => (
                  <div
                    key={p.peerId}
                    className="flex items-center gap-3 bg-[var(--color-surface)] rounded-xl px-3 py-2.5 border border-[var(--color-border)] shadow-sm"
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                        p.role === 'AGENT'
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      )}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.name}
                        {p.isLocal && <span className="text-muted font-normal"> (You)</span>}
                      </p>
                      <p className="text-xs text-muted capitalize">{p.role.toLowerCase()}</p>
                    </div>
                    {p.handRaised && (
                      <Hand className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    {role === 'AGENT' && !p.isLocal && p.role !== 'AGENT' && (
                      <button
                        type="button"
                        title={`Remove ${p.name}`}
                        disabled={kickingPeerId === p.peerId}
                        onClick={() => handleKickParticipant(p.peerId, p.name)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                      >
                        {kickingPeerId === p.peerId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {messages.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-8">No messages yet</p>
              )}
              {messages.map((msg) => {
                const mine = msg.senderName === name;
                return (
                  <div key={msg.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold',
                        mine ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {msg.senderName.charAt(0).toUpperCase()}
                    </div>
                    <div className={cn('max-w-[75%]', mine && 'items-end')}>
                      {!mine && (
                        <p className="text-[11px] font-medium text-slate-500 mb-1 ml-1">
                          {msg.senderName}
                        </p>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-3.5 py-2 text-sm',
                          mine
                            ? 'bg-indigo-500 text-white rounded-br-md'
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                        )}
                      >
                        <p>{msg.text}</p>
                        {msg.fileUrl && (
                          <a
                            href={`${API_URL.replace('/api', '')}${msg.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'underline text-xs mt-1 block',
                              mine ? 'text-indigo-100' : 'text-indigo-600'
                            )}
                          >
                            {msg.fileName || 'Download file'}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-slate-100 bg-white">
              <div className="flex gap-2 items-end">
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
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
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
                  placeholder="Write a message…"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 bg-white"
                />
                <button
                  onClick={() => {
                    sendMessage(message);
                    setMessage('');
                  }}
                  className="p-2.5 rounded-xl btn-primary"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ControlBtn({
  children,
  onClick,
  active,
  off,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  off?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-11 h-11 rounded-full flex items-center justify-center transition-all',
        danger
          ? 'bg-red-500 text-white hover:bg-red-600'
          : off
            ? 'bg-red-50 text-red-500 hover:bg-red-100'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}
