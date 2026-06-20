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

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

const getSceneVersion = (elements: readonly ExcalidrawElement[]): number => {
  return elements.reduce((acc, el) => acc + el.version, 0);
};

export function Whiteboard({
  socket,
  sessionId,
  ownPeerId,
  name,
}: {
  socket: Socket | null;
  sessionId: string;
  ownPeerId: string | null;
  name: string;
}) {
  const { theme } = useTheme();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isRemoteRef = useRef(false);
  const lastVersionRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [collaborators, setCollaborators] = useState<Map<string, any>>(new Map<string, any>());

  const applyElements = useCallback((elements: readonly ExcalidrawElement[]) => {
    const api = apiRef.current;
    if (!api || !Array.isArray(elements)) return;
    isRemoteRef.current = true;
    lastVersionRef.current = getSceneVersion(elements);
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

    const onPointerSync = ({
      peerId,
      pointer,
      button,
      username,
    }: {
      peerId: string;
      pointer: { x: number; y: number } | null;
      button: string;
      username: string;
    }) => {
      setCollaborators((prev) => {
        const next = new Map<string, any>(prev);
        if (!pointer) {
          next.delete(peerId);
        } else {
          const colors = [
            { background: '#e11d48', stroke: '#fff' }, // Rose
            { background: '#2563eb', stroke: '#fff' }, // Blue
            { background: '#16a34a', stroke: '#fff' }, // Green
            { background: '#ea580c', stroke: '#fff' }, // Orange
            { background: '#7c3aed', stroke: '#fff' }, // Purple
            { background: '#db2777', stroke: '#fff' }, // Pink
          ];
          const colorIndex = Math.abs(hashCode(peerId)) % colors.length;
          
          next.set(peerId as string, {
            username,
            pointer,
            button,
            color: colors[colorIndex],
          });
        }
        
        return next;
      });
    };

    socket.on('whiteboard:sync', onSync);
    socket.on('whiteboard:pointer:sync', onPointerSync);

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
      socket.off('whiteboard:pointer:sync', onPointerSync);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [socket, ready, applyElements]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      if (isRemoteRef.current || !socket) return;

      const currentVersion = getSceneVersion(elements);
      if (currentVersion === lastVersionRef.current) return;
      lastVersionRef.current = currentVersion;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        socket.emit('whiteboard:update', { sessionId, elements: [...elements] });
      }, 250);
    },
    [socket, sessionId]
  );

  const handlePointerUpdate = useCallback(
    (payload: any) => {
      if (!socket || !ownPeerId) return;
      const { pointer, button } = payload;
      if (!pointer) return;
      
      socket.emit('whiteboard:pointer', {
        sessionId,
        pointer: { x: pointer.x, y: pointer.y },
        button,
        username: name,
      });
    },
    [socket, sessionId, ownPeerId, name]
  );

  const handlePointerLeave = useCallback(() => {
    if (!socket || !ownPeerId) return;
    socket.emit('whiteboard:pointer', {
      sessionId,
      pointer: null,
      button: 'up',
      username: name,
    });
  }, [socket, sessionId, ownPeerId, name]);

  // Sync collaborators state to the Excalidraw scene
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !ready) return;
    api.updateScene({ collaborators: collaborators as any });
  }, [collaborators, ready]);

  return (
    <div 
      className="w-full h-full relative" 
      style={{ isolation: 'isolate' }}
      onMouseLeave={handlePointerLeave}
    >
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          setReady(true);
        }}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        isCollaborating={true}
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
    </div>
  );
}
