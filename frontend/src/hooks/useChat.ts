'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { API_URL } from '@/lib/utils';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  text?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileMime?: string | null;
  createdAt: string;
}

export function useChat(socket: Socket | null, sessionId: string, token: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/sessions/${sessionId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setMessages)
      .catch(console.error);
  }, [sessionId, token]);

  useEffect(() => {
    if (!socket) return;

    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat:message', handler);
    return () => {
      socket.off('chat:message', handler);
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || !text.trim()) return;
      socket.emit('chat:message', { text: text.trim() });
    },
    [socket]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!socket) return;
      setSending(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_URL}/sessions/${sessionId}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const fileRecord = await res.json();

        socket.emit('chat:file', {
          fileUrl: fileRecord.url,
          fileName: fileRecord.originalName,
          fileMime: fileRecord.mimeType,
        });
      } finally {
        setSending(false);
      }
    },
    [socket, sessionId, token]
  );

  return { messages, sendMessage, uploadFile, sending, bottomRef };
}
