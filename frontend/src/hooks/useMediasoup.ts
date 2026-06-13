'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { WS_URL } from '@/lib/utils';

type Device = mediasoupClient.types.Device;
type Transport = mediasoupClient.types.Transport;
type Producer = mediasoupClient.types.Producer;
type Consumer = mediasoupClient.types.Consumer;

interface PeerInfo {
  id: string;
  name: string;
  role: string;
}

interface RemoteStream {
  peerId: string;
  name: string;
  role?: string;
  stream: MediaStream;
  screenStream: MediaStream | null;
}

interface PendingProducer {
  producerId: string;
  peerId: string;
  name: string;
  role?: string;
  source?: string;
}

interface RoomJoinedData {
  peerId: string;
  peers: PeerInfo[];
  rtpCapabilities: object;
}

type ProducerSource = 'audio' | 'camera' | 'screen';

interface UseMediasoupOptions {
  token: string;
  onPeerJoined?: (peer: PeerInfo) => void;
  onPeerLeft?: (peerId: string) => void;
  onSessionEnded?: (reason: string) => void;
  onKicked?: (reason: string) => void;
  onRecordingStatus?: (status: { status: string; recordingId?: string }) => void;
  onError?: (message: string) => void;
}

// mediasoup-demo uses empty iceServers — server provides ICE candidates
const ICE_SERVERS: RTCIceServer[] = [];

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
  onKicked,
  onRecordingStatus,
  onError,
}: UseMediasoupOptions) {
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const consumerByProducerRef = useRef<Map<string, Consumer>>(new Map());
  const producerPeerRef = useRef<Map<string, string>>(new Map());
  const producerSourceRef = useRef<Map<string, ProducerSource>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const remoteCameraStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const pendingProducersRef = useRef<PendingProducer[]>([]);
  const consumeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const ownPeerIdRef = useRef<string>('');
  const mediaReadyRef = useRef(false);
  const sessionEndingRef = useRef(false);
  const emitRef = useRef<(event: string, data?: unknown) => Promise<unknown>>(() =>
    Promise.reject(new Error('Not ready'))
  );

  const callbacksRef = useRef({ onPeerJoined, onPeerLeft, onSessionEnded, onKicked, onRecordingStatus, onError });
  callbacksRef.current = { onPeerJoined, onPeerLeft, onSessionEnded, onKicked, onRecordingStatus, onError };

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [connected, setConnected] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [ownPeerId, setOwnPeerId] = useState('');
  const hasJoinedRef = useRef(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  function normalizePeer(data: { id?: string; peerId?: string; name: string; role: string }): PeerInfo | null {
    const id = data.id || data.peerId;
    if (!id) return null;
    return { id, name: data.name, role: data.role };
  }

  const teardownMedia = useCallback(() => {
    mediaReadyRef.current = false;
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;
    for (const consumer of consumersRef.current.values()) consumer.close();
    consumersRef.current.clear();
    consumerByProducerRef.current.clear();
    producerPeerRef.current.clear();
    producerSourceRef.current.clear();
    producersRef.current.clear();
    consumedProducersRef.current.clear();
    remoteCameraStreamsRef.current.clear();
    remoteScreenStreamsRef.current.clear();
    pendingProducersRef.current = [];
    consumeQueueRef.current = Promise.resolve();
    setRemoteStreams([]);
    setLocalScreenStream(null);
    setPeers([]);
    setScreenSharing(false);
    setMediaReady(false);
  }, []);

  const syncRemoteStreams = useCallback(() => {
    const peerIds = new Set([
      ...remoteCameraStreamsRef.current.keys(),
      ...remoteScreenStreamsRef.current.keys(),
    ]);
    setRemoteStreams(
      Array.from(peerIds)
        .filter((peerId) => peerId !== ownPeerIdRef.current)
        .map((peerId) => ({
          peerId,
          name: peerNamesRef.current.get(peerId) || 'Participant',
          stream: remoteCameraStreamsRef.current.get(peerId) || new MediaStream(),
          screenStream: remoteScreenStreamsRef.current.get(peerId) || null,
        }))
    );
  }, []);

  const removeConsumerForProducer = useCallback(
    (peerId: string, producerId: string) => {
      const consumer = consumerByProducerRef.current.get(producerId);
      if (consumer) {
        const source = producerSourceRef.current.get(producerId) || 'camera';
        const targetRef = source === 'screen' ? remoteScreenStreamsRef : remoteCameraStreamsRef;
        const stream = targetRef.current.get(peerId);
        if (stream) {
          stream.removeTrack(consumer.track);
          if (stream.getTracks().length === 0) {
            targetRef.current.delete(peerId);
          }
        }
        consumer.close();
        consumersRef.current.delete(consumer.id);
        consumerByProducerRef.current.delete(producerId);
        consumedProducersRef.current.delete(producerId);
        producerPeerRef.current.delete(producerId);
        producerSourceRef.current.delete(producerId);
      }
      syncRemoteStreams();
    },
    [syncRemoteStreams]
  );

  const consumeProducer = useCallback(
    async (
      producerId: string,
      peerId: string,
      name: string,
      role?: string,
      source: ProducerSource = 'camera'
    ) => {
      if (peerId === ownPeerIdRef.current) return;
      if (consumedProducersRef.current.has(producerId)) return;

      if (!deviceRef.current || !recvTransportRef.current) {
        pendingProducersRef.current.push({ producerId, peerId, name, role, source });
        return;
      }

      consumedProducersRef.current.add(producerId);
      peerNamesRef.current.set(peerId, name);
      producerSourceRef.current.set(producerId, source);

      try {
        const response = (await emitRef.current('consume', {
          transportId: recvTransportRef.current.id,
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        })) as { consumer: { id: string; kind: string; rtpParameters: object } };

        const streamId = source === 'screen' ? `${peerId}-screen` : `${peerId}-camera`;

        const mediasoupConsumer = await recvTransportRef.current.consume({
          id: response.consumer.id,
          producerId,
          kind: response.consumer.kind as mediasoupClient.types.MediaKind,
          rtpParameters: response.consumer.rtpParameters as mediasoupClient.types.RtpParameters,
          streamId,
        });

        consumersRef.current.set(mediasoupConsumer.id, mediasoupConsumer);
        consumerByProducerRef.current.set(producerId, mediasoupConsumer);
        producerPeerRef.current.set(producerId, peerId);

        await emitRef.current('resumeConsumer', { consumerId: mediasoupConsumer.id });

        if (mediasoupConsumer.paused) {
          await mediasoupConsumer.resume();
        }

        if (mediasoupConsumer.track) {
          mediasoupConsumer.track.enabled = true;
        }

        const targetRef = source === 'screen' ? remoteScreenStreamsRef : remoteCameraStreamsRef;
        const existing = targetRef.current.get(peerId);
        if (existing) {
          const tracks = existing
            .getTracks()
            .filter((t) => !(t.kind === mediasoupConsumer.track.kind && source !== 'screen' && t.kind === 'video'));
          if (source !== 'screen') {
            const sameKind = tracks.filter((t) => t.kind === mediasoupConsumer.track.kind);
            sameKind.forEach((t) => existing.removeTrack(t));
          }
          existing.addTrack(mediasoupConsumer.track);
        } else {
          targetRef.current.set(peerId, new MediaStream([mediasoupConsumer.track]));
        }

        syncRemoteStreams();

        console.log('[mediasoup] consuming', source, 'from', name);
      } catch (err) {
        consumedProducersRef.current.delete(producerId);
        producerSourceRef.current.delete(producerId);
        throw err;
      }
    },
    [syncRemoteStreams]
  );

  const enqueueConsume = useCallback(
    (producerId: string, peerId: string, name: string, role?: string, source?: string) => {
      const src: ProducerSource =
        source === 'screen' ? 'screen' : source === 'audio' ? 'audio' : 'camera';
      consumeQueueRef.current = consumeQueueRef.current
        .then(() => consumeProducer(producerId, peerId, name, role, src))
        .catch((err) => {
          callbacksRef.current.onError?.(
            err instanceof Error ? err.message : 'Failed to consume stream'
          );
        });
    },
    [consumeProducer]
  );

  const flushPendingProducers = useCallback(async () => {
    const pending = [...pendingProducersRef.current];
    pendingProducersRef.current = [];
    for (const p of pending) {
      const src: ProducerSource =
        p.source === 'screen' ? 'screen' : p.source === 'audio' ? 'audio' : 'camera';
      await consumeProducer(p.producerId, p.peerId, p.name, p.role, src);
    }
  }, [consumeProducer]);

  const setupMediasoup = useCallback(
    async (roomData: RoomJoinedData, stream: MediaStream) => {
      ownPeerIdRef.current = roomData.peerId;
      setOwnPeerId(roomData.peerId);

      const device = new mediasoupClient.Device();
      await device.load({
        routerRtpCapabilities: roomData.rtpCapabilities as mediasoupClient.types.RtpCapabilities,
      });
      deviceRef.current = device;
      setPeers(roomData.peers.filter((p) => p.id));
      for (const peer of roomData.peers) {
        if (peer.id) peerNamesRef.current.set(peer.id, peer.name);
      }

      const recvResponse = (await emitRef.current('createTransport')) as {
        transport: mediasoupClient.types.TransportOptions;
      };
      const recvTransport = device.createRecvTransport({
        ...recvResponse.transport,
        iceServers: ICE_SERVERS,
      });
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        emitRef.current('connectTransport', { transportId: recvTransport.id, dtlsParameters })
          .then(() => callback())
          .catch(errback);
      });

      recvTransport.on('connectionstatechange', (state) => {
        console.log('[mediasoup] recv transport state:', state);
        if (
          state === 'failed' &&
          !sessionEndingRef.current &&
          mediaReadyRef.current &&
          socketRef.current?.connected
        ) {
          callbacksRef.current.onError?.('Media receive connection failed — check MEDIASOUP_ANNOUNCED_IP');
        }
      });

      const sendResponse = (await emitRef.current('createTransport')) as {
        transport: mediasoupClient.types.TransportOptions;
      };
      const sendTransport = device.createSendTransport({
        ...sendResponse.transport,
        iceServers: ICE_SERVERS,
      });
      sendTransportRef.current = sendTransport;

      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        emitRef.current('connectTransport', { transportId: sendTransport.id, dtlsParameters })
          .then(() => callback())
          .catch(errback);
      });

      sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
        emitRef.current('produce', { transportId: sendTransport.id, kind, rtpParameters, appData })
          .then((res) => callback({ id: (res as { id: string }).id }))
          .catch(errback);
      });

      sendTransport.on('connectionstatechange', (state) => {
        console.log('[mediasoup] send transport state:', state);
        if (
          state === 'failed' &&
          !sessionEndingRef.current &&
          mediaReadyRef.current &&
          socketRef.current?.connected
        ) {
          callbacksRef.current.onError?.('Media send connection failed — check MEDIASOUP_ANNOUNCED_IP');
        }
      });

      mediaReadyRef.current = true;

      const existingProducers = (await emitRef.current('getProducers')) as {
        producerId: string;
        peerId: string;
        name: string;
        role: string;
        source?: string;
      }[];
      for (const p of existingProducers) {
        if (p.peerId !== ownPeerIdRef.current) {
          const src: ProducerSource =
            p.source === 'screen' ? 'screen' : p.source === 'audio' ? 'audio' : 'camera';
          await consumeProducer(p.producerId, p.peerId, p.name, p.role, src);
        }
      }
      await flushPendingProducers();

      for (const track of stream.getAudioTracks()) {
        const producer = await sendTransport.produce({ track, appData: { source: 'audio' } });
        producersRef.current.set('audio', producer);
      }
      for (const track of stream.getVideoTracks()) {
        const producer = await sendTransport.produce({ track, appData: { source: 'camera' } });
        producersRef.current.set('video', producer);
      }

      setMediaReady(true);
    },
    [consumeProducer, flushPendingProducers]
  );

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
          transports: ['polling', 'websocket'],  // polling first is more reliable through Nginx proxy
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

        sock.on('connect', async () => {
          if (!hasJoinedRef.current || aborted) return;
          try {
            setConnected(true);
            teardownMedia();
            const stream = localStreamRef.current;
            if (!stream) return;
            const roomResponse = await socketRequest<RoomJoinedData & { success?: boolean }>(
              sock,
              'room:join'
            );
            if (aborted) return;
            await setupMediasoup(roomResponse, stream);
            console.log('[mediasoup] reconnected and rejoined room');
          } catch (err) {
            callbacksRef.current.onError?.(
              err instanceof Error ? err.message : 'Failed to reconnect media'
            );
          }
        });

        sock.on('peer:joined', (data: { id?: string; peerId?: string; name: string; role: string }) => {
          const peer = normalizePeer(data);
          if (!peer || peer.id === ownPeerIdRef.current) return;
          peerNamesRef.current.set(peer.id, peer.name);
          setPeers((prev) => (prev.some((p) => p.id === peer.id) ? prev : [...prev, peer]));
          callbacksRef.current.onPeerJoined?.(peer);
        });

        sock.on('peer:left', ({ peerId }: { peerId: string }) => {
          setPeers((prev) => prev.filter((p) => p.id !== peerId));
          peerNamesRef.current.delete(peerId);
          for (const [producerId, pid] of producerPeerRef.current.entries()) {
            if (pid === peerId) {
              removeConsumerForProducer(peerId, producerId);
            }
          }
          remoteCameraStreamsRef.current.delete(peerId);
          remoteScreenStreamsRef.current.delete(peerId);
          syncRemoteStreams();
          callbacksRef.current.onPeerLeft?.(peerId);
        });

        sock.on('newProducer', ({ producerId, peerId, name, role, source }: PendingProducer) => {
          if (peerId === ownPeerIdRef.current) return;
          console.log('[mediasoup] newProducer', producerId, source, 'from', name);
          enqueueConsume(producerId, peerId, name, role, source);
        });

        sock.on('producerClosed', ({ peerId, producerId }: { peerId: string; producerId: string }) => {
          if (producerId) {
            removeConsumerForProducer(peerId, producerId);
          } else {
            remoteCameraStreamsRef.current.delete(peerId);
            remoteScreenStreamsRef.current.delete(peerId);
            syncRemoteStreams();
          }
        });

        sock.on('session:ended', ({ reason }: { reason: string }) => {
          sessionEndingRef.current = true;
          teardownMedia();
          callbacksRef.current.onSessionEnded?.(reason);
        });

        sock.on('kicked', ({ reason }: { reason: string }) => {
          sessionEndingRef.current = true;
          mediaReadyRef.current = false;
          teardownMedia();
          callbacksRef.current.onKicked?.(reason);
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
        hasJoinedRef.current = true;
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
      for (const consumer of consumersRef.current.values()) {
        consumer.close();
      }
      consumersRef.current.clear();
      consumerByProducerRef.current.clear();
      producerPeerRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
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
    if (screenSharing) return;
    const producer = producersRef.current.get('video');
    if (producer) {
      if (videoEnabled) producer.pause();
      else producer.resume();
      setVideoEnabled(!videoEnabled);
      socketRef.current?.emit('mediaState', { audio: audioEnabled, video: !videoEnabled });
    }
  }, [audioEnabled, videoEnabled, screenSharing]);

  const stopScreenShare = useCallback(async () => {
    const screenProducer = producersRef.current.get('screen');
    if (screenProducer) {
      socketRef.current?.emit('closeProducer', { producerId: screenProducer.id });
      screenProducer.close();
      producersRef.current.delete('screen');
    }
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalScreenStream(null);
    setScreenSharing(false);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const sendTransport = sendTransportRef.current;
    if (!sendTransport) return;

    if (screenSharing) {
      await stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenTrack.onended = () => {
        void stopScreenShare();
      };

      const producer = await sendTransport.produce({
        track: screenTrack,
        appData: { source: 'screen' },
      });
      producersRef.current.set('screen', producer);
      screenStreamRef.current = screenStream;
      setLocalScreenStream(new MediaStream([screenTrack]));
      setScreenSharing(true);
    } catch {
      // user cancelled picker
    }
  }, [screenSharing, stopScreenShare]);

  const endSession = useCallback(() => {
    sessionEndingRef.current = true;
    mediaReadyRef.current = false;
    return emitRef.current('session:end') as Promise<{ success: boolean }>;
  }, []);

  const startRecording = useCallback(
    () => emitRef.current('recording:start') as Promise<{ recording: { id: string } }>,
    []
  );

  const stopRecording = useCallback(
    (recordingId: string) => emitRef.current('recording:stop', { recordingId }),
    []
  );

  const leave = useCallback(() => {
    sessionEndingRef.current = true;
    mediaReadyRef.current = false;
    socketRef.current?.emit('leave');
    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }
    consumersRef.current.clear();
    consumerByProducerRef.current.clear();
    producerPeerRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
    setMediaReady(false);
    mediaReadyRef.current = false;
  }, []);

  const kickPeer = useCallback((targetPeerId: string) => {
    return new Promise<{ success: boolean }>((resolve, reject) => {
      const sock = socketRef.current;
      if (!sock?.connected) return reject(new Error('Not connected'));
      sock.emit('kickPeer', { targetPeerId }, (res: { success: boolean; error?: string }) => {
        if (res?.success) resolve(res);
        else reject(new Error(res?.error || 'Failed to remove participant'));
      });
    });
  }, []);

  return {
    connected,
    mediaReady,
    localStream,
    localScreenStream,
    remoteStreams,
    peers,
    ownPeerId,
    audioEnabled,
    videoEnabled,
    screenSharing,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    endSession,
    startRecording,
    stopRecording,
    leave,
    kickPeer,
    socket,
  };
}
