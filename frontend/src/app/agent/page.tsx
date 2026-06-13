'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Video, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { apiFetch, saveAuth } from '@/lib/utils';

export default function AgentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('agent-secret-key');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<{
    sessionId: string;
    inviteToken: string;
    inviteLink: string;
    token: string;
    participantId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = await apiFetch<{ token: string; name: string }>('/auth/agent', {
        method: 'POST',
        body: JSON.stringify({ name, secret }),
      });

      const sessionData = await apiFetch<{
        sessionId: string;
        inviteToken: string;
        inviteLink: string;
        token: string;
        participantId: string;
      }>('/sessions', { method: 'POST' }, auth.token);

      saveAuth('agentAuth', {
        token: sessionData.token,
        name: auth.name,
        sessionId: sessionData.sessionId,
        participantId: sessionData.participantId,
        role: 'AGENT',
      });

      setSession(sessionData as NonNullable<typeof session>);
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

  function joinCall() {
    if (!session) return;
    router.push(`/call/${session.sessionId}`);
  }

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950" />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
            <Video className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agent Portal</h1>
            <p className="text-slate-400 text-sm">Create a support session</p>
          </div>
        </div>

        {!session ? (
          <Card glow>
            <form onSubmit={handleAuth} className="space-y-5">
              <Input
                id="name"
                label="Your Name"
                placeholder="e.g. Sarah Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                id="secret"
                label="Agent Secret Key"
                type="password"
                placeholder="Enter agent secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
              />
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Create Session
              </Button>
            </form>
          </Card>
        ) : (
          <Card glow className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold mb-1">Session Created!</h2>
              <p className="text-slate-400 text-sm">Share the invite link with your customer</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Invite Link</p>
              <p className="text-sm text-indigo-300 break-all font-mono">{session.inviteLink}</p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={copyLink} className="flex-1">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button onClick={joinCall} className="flex-1">
                Join Call
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
