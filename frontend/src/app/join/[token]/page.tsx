'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Headphones, Loader2, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { apiFetch, saveAuth, loadAuth, API_URL } from '@/lib/utils';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ agentName?: string } | null>(null);

  useEffect(() => {
    const user = loadAuth<{ name: string; role: string }>('userAuth');
    if (user?.name) setName(user.name);

    fetch(`${API_URL}/sessions/invite/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json();
          throw new Error(data.error || 'Invalid invite');
        }
        return r.json();
      })
      .then(setSessionInfo)
      .catch((err) => setError(err.message))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{
        sessionId: string;
        token: string;
        participantId: string;
      }>(`/sessions/join/${token}`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      saveAuth('customerAuth', {
        token: data.token,
        name,
        sessionId: data.sessionId,
        participantId: data.participantId,
        role: 'CUSTOMER',
      });

      router.push(`/call/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">AssistSphere</span>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {error && !sessionInfo ? (
          <Card className="text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Cannot join</h2>
            <p className="text-slate-500">{error}</p>
          </Card>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
                <Headphones className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Join support call</h1>
              {sessionInfo?.agentName && (
                <p className="text-slate-500">
                  Your agent:{' '}
                  <span className="text-slate-900 font-semibold">{sessionInfo.agentName}</span>
                </p>
              )}
            </div>

            <Card glow>
              <form onSubmit={handleJoin} className="space-y-5">
                <Input
                  id="name"
                  label="Your name"
                  placeholder="How should we address you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                    {error}
                  </div>
                )}
                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Enter video room
                </Button>
                <p className="text-xs text-center text-slate-400">
                  Camera & microphone access required
                </p>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
