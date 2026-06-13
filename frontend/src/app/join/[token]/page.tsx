'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { apiFetch, saveAuth, API_URL } from '@/lib/utils';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ agentName?: string; sessionId?: string } | null>(null);

  useEffect(() => {
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
        agentName: string;
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/30 via-slate-950 to-slate-950" />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {error && !sessionInfo ? (
          <Card className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Unable to Join</h2>
            <p className="text-slate-400">{error}</p>
          </Card>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Join Support Call</h1>
              {sessionInfo?.agentName && (
                <p className="text-slate-400">
                  Agent <span className="text-white font-medium">{sessionInfo.agentName}</span> is waiting for you
                </p>
              )}
            </div>

            <Card glow>
              <form onSubmit={handleJoin} className="space-y-5">
                <Input
                  id="name"
                  label="Your Name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Join Video Call
                </Button>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
