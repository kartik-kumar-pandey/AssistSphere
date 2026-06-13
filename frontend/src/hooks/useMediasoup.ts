'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { WS_URL } from '@/lib/utils';

type Device = mediasoupClient.types.Device;
type Transport = mediasoupClient.types.Transport;
type Producer = mediasoupClient.types.Producer;

interface PeerInfo {
  id: string;
  name: string;
  role: string;
}

interface RemoteStream {
  peerId: string;
  name: string;
  stream: MediaStream;
}

interface RoomJoinedData {
  peerId: string;
  peers: PeerInfo[];
  rtpCapabilities: object;
}

interface PendingProducer {
  producerId: string;
  peerId: string;
  name: string;
  role?: string;
}

interface UseMediasoupOptions {
  token: string;
  onPeerJoined?: (peer: PeerInfo) => void;
  onPeerLeft?: (peerId: string) => void;
  onSessionEnded?: (reason: string) => void;
  onRecordingStatus?: (status: { status: string; recordingId?: string }) => void;
  onError?: (message: string) => void;
}

function waitForSocketConnect(sock: Socket, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sock.connected) return resolve();

    const timer = setTimeout(() => reject(new Error('Socket connection timed out')), timeoutMs);

    const onConnect = () => {
      clearTimeout(timer);
      cleanup();
      resolve();
    };

    const onError = (err: Error) => {
      clearTimeout(timer);
      cleanup();
      reject(new Error(`Connection failed: ${err.message}`));
    };

    const cleanup = () => {
      sock.off('connect', onConnect);
      sock.off('connect_error', onError);
    };

    sock.once('connect', onConnect);
    sock.once('connect_error', onError);
  });
}

function socketRequest<T>(sock: Socket, event: string, data?: unknown, timeoutMs = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!sock.connected) return reject(new Error('Socket not connected'));

    const timer = setTimeout(() => reject(new Error(`${event} timed out`)), timeoutMs);

    const onResponse = (response: T & { success?: boolean; error?: string }) => {
      clearTimeout(timer);
      if (response && typeof response === 'object' && 'success' in response && response.success === false) {
        reject(new Error(response.error || `${event} failed`));
      } else {
        resolve(response);
      }
    };

    // Socket.io: never pass `undefined` as payload — it becomes arg1 and shifts the ack callback
    if (data === undefined) {
      sock.emit(event, onResponse);
    } else {
      sock.emit(event, data, onResponse);
    }
  });
}

export function useMediasoup({
  token,
  onPeerJoined,
  onPeerLeft,
  onSessionEnded,
  onRecordingStatus,
  onError,
}: UseMediasoupOptions) {
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const pendingProducersRef = useRef<PendingProducer[]>([]);
  const ownPeerIdRef = useRef<string>('');
  const mediaReadyRef = useRef(false);
  const emitRef = useRef<(event: string, data?: unknown) => Promise<unknown>>(() => Promise.reject(new Error('Not ready')));

  const callbacksRef = useRef({ onPeerJoined, onPeerLeft, onSessionEnded, onRecordingStatus, onError });
  callbacksRef.current = { onPeerJoined, onPeerLeft, onSessionEnded, onRecordingStatus, onError };

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [connected, setConnected] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  const syncRemoteStreams = useCallback(() => {
    setRemoteStreams(
      Array.from(remoteStreamsRef.current.entries())
        .filter(([peerId]) => peerId !== ownPeerIdRef.current)
        .map(([peerId, stream]) => ({
          peerId,
          name: peerNamesRef.current.get(peerId) || 'Participant',
          stream,
        }))
    );
  }, []);

  const consumeProducer = useCallback(
    async (producerId: string, peerId: string, name: string, role?: string) => {
      if (peerId === ownPeerIdRef.current) return;
      if (consumedProducersRef.current.has(producerId)) return;

      if (!deviceRef.current || !recvTransportRef.current) {
        pendingProducersRef.current.push({ producerId, peerId, name, role });
        return;
      }

      consumedProducersRef.current.add(producerId);
      peerNamesRef.current.set(peerId, name);
      if (role) {
        setPeers((prev) => {
          if (prev.some((p) => p.id === peerId)) return prev;
          return [...prev, { id: peerId, name, role }];
        });
      }

      try {
        const response = (await emitRef.current('consume', {
          transportId: recvTransportRef.current.id,
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        })) as { consumer: { id: string; kind: string; rtpParameters: object } };

        const mediasoupConsumer = await recvTransportRef.current.consume({
          id: response.consumer.id,
          producerId,
          kind: response.consumer.kind as mediasoupClient.types.MediaKind,
          rtpParameters: response.consumer.rtpParameters as mediasoupClient.types.RtpParameters,
        });

        await emitRef.current('resumeConsumer', { consumerId: mediasoupConsumer.id });

        // Ensure track is active
        if (mediasoupConsumer.track) {
          mediasoupConsumer.track.enabled = true;
        }

        let stream = remoteStreamsRef.current.get(peerId);
        if (!stream) {
          stream = new MediaStream();
          remoteStreamsRef.current.set(peerId, stream);
        }

        const existing = stream.getTracks().find((t) => t.kind === mediasoupConsumer.track.kind);
        if (existing) stream.removeTrack(existing);
        stream.addTrack(mediasoupConsumer.track);

        syncRemoteStreams();
        console.log('[mediasoup] consuming producer', producerId, 'from', name);
      } catch (err) {
        consumedProducersRef.current.delete(producerId);
        throw err;
      }
    },
    [syncRemoteStreams]
  );

  const flushPendingProducers = useCallback(async () => {
    const pending = [...pendingProducersRef.current];
    pendingProducersRef.current = [];
    for (const p of pending) {
      await consumeProducer(p.producerId, p.peerId, p.name, p.role);
    }
  }, [consumeProducer]);

  const setupMediasoup = useCallback(
    async (roomData: RoomJoinedData, stream: MediaStream) => {
      ownPeerIdRef.current = roomData.peerId;

      const device = new mediasoupClient.Device();
      await device.load({
        routerRtpCapabilities: roomData.rtpCapabilities as mediasoupClient.types.RtpCapabilities,
      });
      deviceRef.current = device;
      setPeers(roomData.peers);
      for (const peer of roomData.peers) {
        peerNamesRef.current.set(peer.id, peer.name);
      }

      // --- Recv transport FIRST (so we can receive before sending) ---
      const recvResponse = (await emitRef.current('createTransport')) as {
        transport: mediasoupClient.types.TransportOptions;
      };
      const recvTransport = device.createRecvTransport(recvResponse.transport);
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        emitRef.current('connectTransport', { transportId: recvTransport.id, dtlsParameters })
          .then(() => callback())
          .catch(errback);
      });

      recvTransport.on('connectionstatechange', (state) => {
        console.log('[mediasoup] recv transport state:', state);
      });

      // --- Send transport ---
      const sendResponse = (await emitRef.current('createTransport')) as {
        transport: mediasoupClient.types.TransportOptions;
      };
      const sendTransport = device.createSendTransport(sendResponse.transport);
      sendTransportRef.current = sendTransport;

      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        emitRef.current('connectTransport', { transportId: sendTransport.id, dtlsParameters })
          .then(() => callback())
          .catch(errback);
      });

      sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        emitRef.current('produce', { transportId: sendTransport.id, kind, rtpParameters })
          .then((res) => callback({ id: (res as { id: string }).id }))
          .catch(errback);
      });

      sendTransport.on('connectionstatechange', (state) => {
        console.log('[mediasoup] send transport state:', state);
      });

      mediaReadyRef.current = true;

      // Consume existing remote producers BEFORE producing (recv transport connects here)
      const existingProducers = (await emitRef.current('getProducers')) as {
        producerId: string;
        peerId: string;
        name: string;
        role: string;
      }[];
      for (const p of existingProducers) {
        if (p.peerId !== ownPeerIdRef.current) {
          await consumeProducer(p.producerId, p.peerId, p.name, p.role);
        }
      }
      await flushPendingProducers();

      // Produce local tracks LAST (notifies others via newProducer)
      for (const track of stream.getTracks()) {
        const producer = await sendTransport.produce({ track });
        producersRef.current.set(track.kind, producer);
        console.log('[mediasoup] producing', track.kind);
      }

      setMediaReady(true);
    },
    [consumeProducer, flushPendingProducers]
  );

  // Connect once per token — stable dependency
  useEffect(() => {
    let aborted = false;

    async function run() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (aborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const sock = io(WS_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          timeout: 20000,
        });
        socketRef.current = sock;
        setSocket(sock);

        emitRef.current = (event: string, data?: unknown) => socketRequest(sock, event, data);

        sock.on('disconnect', () => {
          setConnected(false);
          setMediaReady(false);
          mediaReadyRef.current = false;
        });

        sock.on('peer:joined', (peer: PeerInfo) => {
          peerNamesRef.current.set(peer.id, peer.name);
          setPeers((prev) => (prev.some((p) => p.id === peer.id) ? prev : [...prev, peer]));
          callbacksRef.current.onPeerJoined?.(peer);
        });

        sock.on('peer:left', ({ peerId }: { peerId: string }) => {
          setPeers((prev) => prev.filter((p) => p.id !== peerId));
          peerNamesRef.current.delete(peerId);
          remoteStreamsRef.current.delete(peerId);
          syncRemoteStreams();
          callbacksRef.current.onPeerLeft?.(peerId);
        });

        sock.on('newProducer', async ({ producerId, peerId, name, role }: PendingProducer) => {
          if (peerId === ownPeerIdRef.current) return;
          console.log('[mediasoup] newProducer detected', producerId, 'from', name);
          try {
            await consumeProducer(producerId, peerId, name, role);
          } catch (err) {
            callbacksRef.current.onError?.(err instanceof Error ? err.message : 'Failed to consume stream');
          }
        });

        sock.on('producerClosed', ({ peerId }: { peerId: string }) => {
          remoteStreamsRef.current.delete(peerId);
          syncRemoteStreams();
        });

        sock.on('session:ended', ({ reason }: { reason: string }) => {
          callbacksRef.current.onSessionEnded?.(reason);
        });

        sock.on('recording:status', (status: { status: string; recordingId?: string }) => {
          callbacksRef.current.onRecordingStatus?.(status);
        });

        if (aborted) return;

        await waitForSocketConnect(sock);
        if (aborted) return;
        setConnected(true);

        const roomResponse = await socketRequest<RoomJoinedData & { success?: boolean }>(sock, 'room:join');
        if (aborted) return;

        console.log('[mediasoup] joined room, peers:', roomResponse.peers?.length ?? 0);
        await setupMediasoup(roomResponse, stream);
      } catch (err) {
        if (!aborted) {
          callbacksRef.current.onError?.(err instanceof Error ? err.message : 'Failed to connect');
        }
      }
    }

    run();

    return () => {
      aborted = true;
      mediaReadyRef.current = false;
      consumedProducersRef.current.clear();
      pendingProducersRef.current = [];
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleAudio = useCallback(() => {
    const producer = producersRef.current.get('audio');
    if (producer) {
      if (audioEnabled) producer.pause();
      else producer.resume();
      setAudioEnabled(!audioEnabled);
      socketRef.current?.emit('mediaState', { audio: !audioEnabled, video: videoEnabled });
    }
  }, [audioEnabled, videoEnabled]);

  const toggleVideo = useCallback(() => {
    const producer = producersRef.current.get('video');
    if (producer) {
      if (videoEnabled) producer.pause();
      else producer.resume();
      setVideoEnabled(!videoEnabled);
      socketRef.current?.emit('mediaState', { audio: audioEnabled, video: !videoEnabled });
    }
  }, [audioEnabled, videoEnabled]);

  const endSession = useCallback(
    () => emitRef.current('session:end') as Promise<{ success: boolean }>,
    []
  );

  const startRecording = useCallback(
    () => emitRef.current('recording:start') as Promise<{ recording: { id: string } }>,
    []
  );

  const stopRecording = useCallback(
    (recordingId: string) => emitRef.current('recording:stop', { recordingId }),
    []
  );

  const leave = useCallback(() => {
    socketRef.current?.emit('leave');
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
    setMediaReady(false);
    mediaReadyRef.current = false;
  }, []);

  return {
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
  };
}
