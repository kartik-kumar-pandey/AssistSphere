import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

export interface Caption {
  peerId: string;
  name: string;
  text: string;
  isFinal: boolean;
}

export function useCaptions(socket: Socket | null, audioEnabled: boolean, ownPeerId: string | null, name: string) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const contextRef = useRef({ socket, ownPeerId, name });

  useEffect(() => {
    contextRef.current = { socket, ownPeerId, name };
  }, [socket, ownPeerId, name]);

  useEffect(() => {
    if (!socket) return;

    const handleCaption = (caption: Caption) => {
      setCaptions((prev) => {
        const filtered = prev.filter((c) => c.peerId !== caption.peerId || c.isFinal);
        const newCaptions = [...filtered, caption].slice(-5); // Keep last 5
        return newCaptions;
      });

      if (caption.isFinal) {
        setTimeout(() => {
          setCaptions((p) => p.filter((c) => c !== caption));
        }, 5000);
      }
    };

    socket.on('peer:caption', handleCaption);

    return () => {
      socket.off('peer:caption', handleCaption);
    };
  }, [socket]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setError(null);
        lastErrorRef.current = null;
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        const isFinal = !!finalTranscript;

        const { socket: currentSocket, ownPeerId: currentPeerId, name: currentName } = contextRef.current;

        if (text.trim() && currentSocket && currentPeerId) {
          const caption: Caption = { peerId: currentPeerId, name: currentName, text, isFinal };
          currentSocket.emit('caption', caption);
          
          setCaptions((prev) => {
            const filtered = prev.filter((c) => c.peerId !== currentPeerId || c.isFinal);
            return [...filtered, caption].slice(-5);
          });

          if (isFinal) {
            setTimeout(() => {
              setCaptions((p) => p.filter((c) => c !== caption));
            }, 5000);
          }
        }
      };

      recognition.onerror = (event: any) => {
        lastErrorRef.current = event.error;
        // Only log non-transient errors to avoid console spam
        const transientErrors = ['no-speech', 'aborted', 'network'];
        if (!transientErrors.includes(event.error)) {
          console.error('Speech recognition error:', event.error);
        }
        switch (event.error) {
          case 'no-speech':
            break;
          case 'aborted':
            break;
          case 'network':
            // Suppress the UI error overlay as requested. We still back off and attempt reconnection.
            break;
          case 'audio-capture':
            setError('No microphone found.');
            break;
          case 'not-allowed':
            setError('Microphone permission blocked. Please allow microphone access for captions.');
            isListeningRef.current = false;
            break;
          default:
            setError(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          const delay = lastErrorRef.current === 'network' ? 5000 : 200;
          setTimeout(() => {
            try {
              recognition.start();
            } catch (err) {
              console.log('Recognition already running');
            }
          }, delay);
        }
      };

      recognitionRef.current = recognition;
    }

    if (audioEnabled && !isListeningRef.current) {
      isListeningRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Ignore start error
      }
    } else if (!audioEnabled && isListeningRef.current) {
      isListeningRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop error
      }
    }

    return () => {
      isListeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        // Ignore cleanup error
      }
    };
  }, [audioEnabled]);

  return { captions, supported, error };
}
