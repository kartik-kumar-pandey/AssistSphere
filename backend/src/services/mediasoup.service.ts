import mediasoup from 'mediasoup';
import type { types } from 'mediasoup';
import { config } from '../config.js';

type Worker = types.Worker;
type Router = types.Router;
type WebRtcTransport = types.WebRtcTransport;
type Producer = types.Producer;
type Consumer = types.Consumer;
type RtpCodecCapability = types.RtpCodecCapability;

const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    preferredPayloadType: 111,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    preferredPayloadType: 96,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    preferredPayloadType: 98,
    parameters: { 'profile-id': 2, 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/h264',
    clockRate: 90000,
    preferredPayloadType: 102,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
];

let worker: Worker;

export interface Peer {
  id: string;
  name: string;
  role: string;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export interface Room {
  sessionId: string;
  router: Router;
  peers: Map<string, Peer>;
}

const rooms = new Map<string, Room>();

export async function initMediasoup() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: config.mediasoup.minPort,
    rtcMaxPort: config.mediasoup.maxPort,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting...');
    process.exit(1);
  });

  console.log(
    `mediasoup worker started (announcedIp=${config.mediasoup.announcedIp}, ports=${config.mediasoup.minPort}-${config.mediasoup.maxPort})`
  );
}

export function getOrCreateRoom(sessionId: string): Room {
  let room = rooms.get(sessionId);
  if (!room) {
    throw new Error('Room not initialized');
  }
  return room;
}

export async function createRoom(sessionId: string): Promise<Room> {
  if (rooms.has(sessionId)) {
    return rooms.get(sessionId)!;
  }

  const router = await worker.createRouter({ mediaCodecs });
  const room: Room = {
    sessionId,
    router,
    peers: new Map(),
  };
  rooms.set(sessionId, room);
  return room;
}

export function destroyRoom(sessionId: string) {
  const room = rooms.get(sessionId);
  if (!room) return;

  for (const peer of room.peers.values()) {
    for (const transport of peer.transports.values()) {
      transport.close();
    }
  }
  room.router.close();
  rooms.delete(sessionId);
}

export function getRoomCount() {
  return rooms.size;
}

export function getParticipantCount() {
  let count = 0;
  for (const room of rooms.values()) {
    count += room.peers.size;
  }
  return count;
}

export function addPeer(sessionId: string, peerId: string, name: string, role: string): Peer {
  const room = getOrCreateRoom(sessionId);
  const peer: Peer = {
    id: peerId,
    name,
    role,
    transports: new Map(),
    producers: new Map(),
    consumers: new Map(),
  };
  room.peers.set(peerId, peer);
  return peer;
}

export function removePeer(
  sessionId: string,
  peerId: string
): { producerId: string; kind: string }[] {
  const room = rooms.get(sessionId);
  if (!room) return [];

  const peer = room.peers.get(peerId);
  if (!peer) return [];

  const closedProducers = Array.from(peer.producers.entries()).map(([producerId, producer]) => ({
    producerId,
    kind: producer.kind,
  }));

  for (const transport of peer.transports.values()) {
    transport.close();
  }
  room.peers.delete(peerId);

  if (room.peers.size === 0) {
    destroyRoom(sessionId);
  }

  return closedProducers;
}

export async function createWebRtcTransport(sessionId: string, peerId: string) {
  const room = getOrCreateRoom(sessionId);
  const peer = room.peers.get(peerId);
  if (!peer) throw new Error('Peer not found');

  const transport = await room.router.createWebRtcTransport({
    listenIps: [{ ip: config.mediasoup.listenIp, announcedIp: config.mediasoup.announcedIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  });

  peer.transports.set(transport.id, transport);

  transport.on('dtlsstatechange', (state: string) => {
    if (state === 'closed') transport.close();
  });

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

export async function connectTransport(
  sessionId: string,
  peerId: string,
  transportId: string,
  dtlsParameters: object
) {
  const room = getOrCreateRoom(sessionId);
  const peer = room.peers.get(peerId);
  if (!peer) throw new Error('Peer not found');

  const transport = peer.transports.get(transportId);
  if (!transport) throw new Error('Transport not found');

  await transport.connect({ dtlsParameters: dtlsParameters as never });
}

export async function produce(
  sessionId: string,
  peerId: string,
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: object,
  appData?: { source?: string }
) {
  const room = getOrCreateRoom(sessionId);
  const peer = room.peers.get(peerId);
  if (!peer) throw new Error('Peer not found');

  const transport = peer.transports.get(transportId);
  if (!transport) throw new Error('Transport not found');

  const source = appData?.source || (kind === 'video' ? 'camera' : 'audio');

  const producer = await transport.produce({
    kind,
    rtpParameters: rtpParameters as never,
    appData: { source },
  });

  peer.producers.set(producer.id, producer);

  producer.on('transportclose', () => {
    peer.producers.delete(producer.id);
  });

  return { id: producer.id };
}

export async function consume(
  sessionId: string,
  peerId: string,
  transportId: string,
  producerId: string,
  rtpCapabilities: object
) {
  const room = getOrCreateRoom(sessionId);
  const peer = room.peers.get(peerId);
  if (!peer) throw new Error('Peer not found');

  const transport = peer.transports.get(transportId);
  if (!transport) throw new Error('Transport not found');

  if (!room.router.canConsume({ producerId, rtpCapabilities: rtpCapabilities as never })) {
    throw new Error('Cannot consume');
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities: rtpCapabilities as never,
    paused: true,
    enableRtx: true,
  });

  peer.consumers.set(consumer.id, consumer);

  consumer.on('transportclose', () => {
    peer.consumers.delete(consumer.id);
  });

  consumer.on('producerclose', () => {
    peer.consumers.delete(consumer.id);
  });

  return {
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

export async function resumeConsumer(sessionId: string, peerId: string, consumerId: string) {
  const room = getOrCreateRoom(sessionId);
  const peer = room.peers.get(peerId);
  if (!peer) throw new Error('Peer not found');

  const consumer = peer.consumers.get(consumerId);
  if (!consumer) throw new Error('Consumer not found');

  await consumer.resume();

  if (consumer.kind === 'video') {
    try {
      await consumer.requestKeyFrame();
    } catch {
      // keyframe may not be available immediately
    }
  }
}

export function getRouterRtpCapabilities(sessionId: string) {
  const room = getOrCreateRoom(sessionId);
  return room.router.rtpCapabilities;
}

export function getOtherProducers(sessionId: string, excludePeerId: string) {
  const room = getOrCreateRoom(sessionId);
  const producers: { peerId: string; name: string; role: string; producerId: string; kind: string; source: string }[] = [];

  for (const [peerId, peer] of room.peers) {
    if (peerId === excludePeerId) continue;
    for (const [producerId, producer] of peer.producers) {
      const source =
        (producer.appData as { source?: string })?.source ||
        (producer.kind === 'audio' ? 'audio' : 'camera');
      producers.push({
        peerId,
        name: peer.name,
        role: peer.role,
        producerId,
        kind: producer.kind,
        source,
      });
    }
  }
  return producers;
}

export function closeProducer(sessionId: string, peerId: string, producerId: string) {
  const room = rooms.get(sessionId);
  if (!room) return;
  const peer = room.peers.get(peerId);
  if (!peer) return;
  const producer = peer.producers.get(producerId);
  if (producer) {
    producer.close();
    peer.producers.delete(producerId);
  }
}

export function getRoomPeers(sessionId: string) {
  const room = rooms.get(sessionId);
  if (!room) return [];
  return Array.from(room.peers.values()).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    hasAudio: Array.from(p.producers.values()).some((pr) => pr.kind === 'audio' && !pr.paused),
    hasVideo: Array.from(p.producers.values()).some((pr) => pr.kind === 'video' && !pr.paused),
  }));
}
