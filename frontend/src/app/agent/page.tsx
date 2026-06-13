'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Video, Copy, Check, History, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { apiFetch, saveAuth, loadAuth } from '@/lib/utils';

interface SessionRow {
  id: string;
  status: string;
  startedAt: string;
  _count: { messages: number; recordings: number };
}

export default function AgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agentToken, setAgentToken] = useState('');
  const [history, setHistory] = useState<SessionRow[]>([]);
  const [session, setSession] = useState<{
    sessionId: string;
    inviteLink: string;
    token: string;
    participantId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<{ token: string; name: string } | null>(null);

  useEffect(() => {
    const user = loadAuth<{ token: string; name: string; role: string }>('userAuth');
    if (user?.role === 'AGENT') {
      setLoggedInUser({ token: user.token, name: user.name });
      setName(user.name);
      setAgentToken(user.token);
    }
  }, []);

  useEffect(() => {
    if (!agentToken) return;
    apiFetch<SessionRow[]>('/sessions/agent/history', {}, agentToken)
      .then(setHistory)
      .catch(() => {});
  }, [agentToken]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let token = agentToken;
      let agentName = name;

      if (loggedInUser) {
        token = loggedInUser.token;
        agentName = loggedInUser.name;
      } else {
        const auth = await apiFetch<{ token: string; name: string }>('/auth/agent', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
        token = auth.token;
        agentName = auth.name;
        setAgentToken(auth.token);
      }

      const sessionData = await apiFetch<{
        sessionId: string;
        inviteToken: string;
        inviteLink: string;
        token: string;
        participantId: string;
      }>('/sessions', { method: 'POST' }, token);

      saveAuth('agentAuth', {
        token: sessionData.token,
        name: agentName,
        sessionId: sessionData.sessionId,
        participantId: sessionData.participantId,
        role: 'AGENT',
      });
      setSession(sessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!session) return;
    navigator.clipboard.writeText(session.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen page-shell">
      <div className="max-w-lg mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl btn-primary flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Agent portal</h1>
            <p className="text-slate-500 text-sm">Create a support session</p>
          </div>
        </div>

        {!session ? (
          <Card glow>
            <form onSubmit={handleAuth} className="space-y-5">
              <Input id="name" label="Your name" placeholder="Sarah Chen" value={name} onChange={(e) => setName(e.target.value)} required disabled={!!loggedInUser} />
              {loggedInUser && (
                <p className="text-sm text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2">
                  Signed in as {loggedInUser.name}
                </p>
              )}
              {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}
              <Button type="submit" loading={loading} className="w-full" size="lg">Create session</Button>
            </form>
          </Card>
        ) : (
          <Card glow className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Ready to go</h2>
              <p className="text-slate-500 text-sm mt-1">Share this link with your customer</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Invite link</p>
              <p className="text-sm text-indigo-600 break-all font-mono">{session.inviteLink}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={copyLink} className="flex-1">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button onClick={() => router.push(`/call/${session.sessionId}`)} className="flex-1">
                Join call
              </Button>
            </div>
          </Card>
        )}

        {history.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-slate-500 flex items-center gap-2 mb-4">
              <History className="w-4 h-4" />
              Recent sessions
            </h3>
            <div className="space-y-2">
              {history.slice(0, 5).map((s) => (
                <Link key={s.id} href={`/summary/${s.id}`} className="block card px-4 py-3 hover:border-indigo-200 transition-colors">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium capitalize text-slate-800">{s.status.toLowerCase()}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(s.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
