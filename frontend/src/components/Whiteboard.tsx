'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import { Socket } from 'socket.io-client';
import { useTheme } from '@/components/ThemeProvider';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center text-muted text-sm">
      Loading whiteboard…
    </div>
  ) }
);

export function Whiteboard({ socket, sessionId }: { socket: Socket | null; sessionId: string }) {
  const { theme } = useTheme();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isRemoteRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);

  const applyElements = useCallback((elements: readonly ExcalidrawElement[]) => {
    const api = apiRef.current;
    if (!api || !Array.isArray(elements)) return;
    isRemoteRef.current = true;
    api.updateScene({ elements: [...elements] });
    requestAnimationFrame(() => {
      isRemoteRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!socket || !ready) return;

    const onSync = ({ elements }: { elements: ExcalidrawElement[] }) => {
      if (Array.isArray(elements) && elements.length > 0) {
        applyElements(elements);
      }
    };

    socket.on('whiteboard:sync', onSync);

    socket.emit(
      'whiteboard:get',
      (res: { success?: boolean; elements?: ExcalidrawElement[] }) => {
        if (res?.elements?.length) {
          applyElements(res.elements);
        }
      }
    );

    return () => {
      socket.off('whiteboard:sync', onSync);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [socket, ready, applyElements]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      if (isRemoteRef.current || !socket) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        socket.emit('whiteboard:update', { sessionId, elements: [...elements] });
      }, 250);
    },
    [socket, sessionId]
  );

  return (
    <div className="w-full h-full relative" style={{ isolation: 'isolate' }}>
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          setReady(true);
        }}
        onChange={handleChange}
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
    </div>
  );
}
