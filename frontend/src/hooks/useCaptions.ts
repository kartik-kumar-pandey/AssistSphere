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
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const contextRef = useRef({ socket, ownPeerId, name });

  useEffect(() => {
    contextRef.current = { socket, ownPeerId, name };
  }, [socket, ownPeerId, name]);

  useEffect(() => {
    if (!socket) return;

    const handleCaption = (caption: Caption) => {
      setCaptions((prev) => {
        // Remove older non-final captions from the same peer
        const filtered = prev.filter((c) => c.peerId !== caption.peerId || c.isFinal);
        const newCaptions = [...filtered, caption].slice(-5); // Keep last 5
        return newCaptions;
      });

      // Clear final captions after 5 seconds
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
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

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
        switch (event.error) {
          case 'no-speech':
            // Normal during silence
            break;
          case 'aborted':
            // User or browser stopped recognition
            break;
          case 'network':
            // Network issue with cloud speech service — retry handled by onend
            break;
          case 'audio-capture':
            // No microphone available
            break;
          case 'not-allowed':
            isListeningRef.current = false;
            break;
          default:
            console.error('Speech recognition error:', event.error);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (err) {
              console.log('Recognition already running');
            }
          }, 200);
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

  return { captions };
}
