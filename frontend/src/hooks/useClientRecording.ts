'use client';

import { useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';

interface StreamSource {
  peerId: string;
  name: string;
  stream: MediaStream;
}

interface UseClientRecordingOptions {
  token: string;
  localStream: MediaStream | null;
  localScreenStream?: MediaStream | null;
  localName: string;
  remoteStreams: { peerId: string; name: string; stream: MediaStream; screenStream?: MediaStream | null }[];
  onStatusChange?: (status: string, recordingId?: string) => void;
  startRecordingSocket: () => Promise<{ recording: { id: string } }>;
  stopRecordingSocket: (recordingId: string) => Promise<unknown>;
}

const CANVAS_W = 1280;
const CANVAS_H = 720;

function createVideoElement(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.play().catch(() => {});
  return video;
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x, y, w, h);

  if (video.readyState >= 2 && video.videoWidth > 0) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(video, dx, dy, dw, dh);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y + h - 36, w, 36);
  ctx.fillStyle = '#fff';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(label, x + 12, y + h - 12);
}

export function useClientRecording({
  token,
  localStream,
  localScreenStream,
  localName,
  remoteStreams,
  onStatusChange,
  startRecordingSocket,
  stopRecordingSocket,
}: UseClientRecordingOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const stopCompositor = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = 0;
    for (const el of videoElsRef.current.values()) {
      el.srcObject = null;
    }
    videoElsRef.current.clear();
    canvasRef.current = null;
  }, []);

  const buildCompositeStream = useCallback(() => {
    const sources: StreamSource[] = [];
    if (localStream) {
      sources.push({ peerId: 'local', name: localName, stream: localStream });
    }
    if (localScreenStream) {
      sources.push({ peerId: 'local-screen', name: `${localName} (Screen)`, stream: localScreenStream });
    }
    for (const remote of remoteStreams) {
      sources.push({ peerId: remote.peerId, name: remote.name, stream: remote.stream });
      if (remote.screenStream) {
        sources.push({
          peerId: `${remote.peerId}-screen`,
          name: `${remote.name} (Screen)`,
          stream: remote.screenStream,
        });
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d')!;

    for (const src of sources) {
      if (!videoElsRef.current.has(src.peerId)) {
        videoElsRef.current.set(src.peerId, createVideoElement(src.stream));
      } else {
        const el = videoElsRef.current.get(src.peerId)!;
        if (el.srcObject !== src.stream) {
          el.srcObject = src.stream;
          el.play().catch(() => {});
        }
      }
    }

    const count = Math.max(sources.length, 1);
    const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const tileW = CANVAS_W / cols;
    const tileH = CANVAS_H / rows;

    const drawFrame = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      sources.forEach((src, i) => {
        const video = videoElsRef.current.get(src.peerId);
        if (!video) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawTile(ctx, video, src.name, col * tileW, row * tileH, tileW, tileH);
      });

      animFrameRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const canvasStream = canvas.captureStream(30);
    const audioTracks: MediaStreamTrack[] = [];
    if (localStream) {
      for (const t of localStream.getAudioTracks()) audioTracks.push(t);
    }
    for (const remote of remoteStreams) {
      for (const t of remote.stream.getAudioTracks()) {
        if (!audioTracks.some((x) => x.id === t.id)) audioTracks.push(t);
      }
    }

    return new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
  }, [localStream, localScreenStream, localName, remoteStreams]);

  const start = useCallback(async () => {
    const { recording } = await startRecordingSocket();
    recordingIdRef.current = recording.id;
    onStatusChange?.('IN_PROGRESS', recording.id);

    const stream = buildCompositeStream();
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(1000);
    recorderRef.current = recorder;

    return recording;
  }, [buildCompositeStream, onStatusChange, startRecordingSocket]);

  const stop = useCallback(async () => {
    const recordingId = recordingIdRef.current;
    if (!recordingId) return;

    onStatusChange?.('PROCESSING', recordingId);

    await new Promise<void>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    recorderRef.current = null;
    stopCompositor();
    await stopRecordingSocket(recordingId);

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    chunksRef.current = [];

    const formData = new FormData();
    formData.append('file', blob, `recording-${recordingId}.webm`);

    await apiFetch(`/recordings/${recordingId}/upload`, { method: 'POST', body: formData }, token);

    onStatusChange?.('READY', recordingId);
    recordingIdRef.current = '';
  }, [onStatusChange, stopRecordingSocket, stopCompositor, token]);

  return { start, stop };
};
