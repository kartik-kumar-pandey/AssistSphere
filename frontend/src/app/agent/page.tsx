'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Video, Check, History, Clock, Share2, LogIn, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { InviteShareMenu } from '@/components/InviteShareMenu';
import { apiFetch, saveAuth, loadAuth, cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

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
    inviteToken: string;
    token: string;
    participantId: string;
  } | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<{ token: string; name: string } | null>(null);

  useEffect(() => {
    const user = loadAuth<{ token: string; name: string; role: string }>('userAuth');
    if (user?.role === 'AGENT') {
      setLoggedInUser({ token: user.token, name: user.name });
      setName(user.name);
      setAgentToken(user.token);
    } else {
      const persistent = loadAuth<{ token: string; name: string }>('persistentAgent');
      if (persistent?.token) {
        setName(persistent.name);
        setAgentToken(persistent.token);
      }
    }

    // Check if there is already an active session cached
    const cachedSession = loadAuth<{
      token: string;
      name: string;
      sessionId: string;
      inviteLink: string;
      inviteToken: string;
      role: string;
      participantId?: string;
    }>('agentAuth');

    if (cachedSession && cachedSession.sessionId) {
      // Verify with the backend if the session is still active
      apiFetch<{ status: string }>(`/sessions/${cachedSession.sessionId}`, {}, cachedSession.token)
        .then((res) => {
          if (res && res.status === 'ACTIVE') {
            setSession({
              sessionId: cachedSession.sessionId,
              inviteLink: cachedSession.inviteLink,
              inviteToken: cachedSession.inviteToken,
              token: cachedSession.token,
              participantId: cachedSession.participantId || ''
            });
            setAgentToken(cachedSession.token);
          } else {
            // Session has ended, clear the cached active session
            localStorage.removeItem('agentAuth');
            const user = loadAuth<{ token: string; name: string; role: string }>('userAuth');
            if (user?.token) {
              setAgentToken(user.token);
            } else {
              const persistent = loadAuth<{ token: string; name: string }>('persistentAgent');
              if (persistent?.token) setAgentToken(persistent.token);
            }
          }
        })
        .catch(() => {
          // Clear if verification fails (e.g. invalid session ID or expired)
          localStorage.removeItem('agentAuth');
          const user = loadAuth<{ token: string; name: string; role: string }>('userAuth');
          if (user?.token) {
            setAgentToken(user.token);
          } else {
            const persistent = loadAuth<{ token: string; name: string }>('persistentAgent');
            if (persistent?.token) setAgentToken(persistent.token);
          }
        });
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
        saveAuth('persistentAgent', { token: auth.token, name: auth.name });
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
        inviteLink: sessionData.inviteLink,
        inviteToken: sessionData.inviteToken,
        role: 'AGENT',
      });
      setSession(sessionData);
      
      // Instantly refresh history to include the new session
      apiFetch<SessionRow[]>('/sessions/agent/history', {}, token)
        .then(setHistory)
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateNewInstead = () => {
    setSession(null);
    localStorage.removeItem('agentAuth');
  };

  return (
    <div className="min-h-screen page-shell hero-mesh">
      {/* Navbar header */}
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <Video className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-lg font-bold text-[var(--color-text)] tracking-tight">Agent Portal</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main split grid */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-5 gap-8 items-stretch">
          
          {/* Left panel: Active session control (3 columns) */}
          <div className="md:col-span-3 flex flex-col">
            {!session ? (
              <Card className="p-6 border-[var(--color-border)] shadow-lg bg-[var(--color-surface)]/85 backdrop-blur-md rounded-2xl flex-1 flex flex-col justify-between">
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-[var(--color-text)]">Create a Support Session</h2>
                    <p className="text-muted text-sm mt-1">Start a secure WebRTC support call and invite your customer.</p>
                  </div>
                  <form onSubmit={handleAuth} className="space-y-5">
                    <Input id="name" label="Your name" placeholder="Kartik Pandey" value={name} onChange={(e) => setName(e.target.value)} required disabled={!!loggedInUser} />
                    {loggedInUser && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl px-3 py-2 font-medium">
                        Signed in as {loggedInUser.name}
                      </p>
                    )}
                    {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}
                    <Button type="submit" loading={loading} className="w-full btn-primary h-11 text-sm font-semibold rounded-xl mt-2">
                      Create session
                    </Button>
                  </form>
                </div>
              </Card>
            ) : (
              <Card className="p-6 border-[var(--color-border)] shadow-lg bg-[var(--color-surface)]/85 backdrop-blur-md rounded-2xl flex-1 flex flex-col justify-between space-y-6">
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-[var(--color-text)]">Active Support Session</h2>
                    <p className="text-muted text-sm mt-1">A secure room is reserved. Invite a customer and join the call.</p>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text)]">Room ready</p>
                        <p className="text-xs text-muted">Customer link is prepared and online</p>
                      </div>
                    </div>

                    <div className="bg-[var(--color-surface-muted)] rounded-xl p-4 border border-[var(--color-border)]">
                      <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5">Invite link</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 break-all font-mono select-all bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-border)]">{session.inviteLink}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <InviteShareMenu inviteLink={session.inviteLink} triggerLabel="Share link" triggerClassName="flex-1" />
                      <Button onClick={() => router.push(`/call/${session.sessionId}`)} className="flex-1 btn-primary h-11 text-sm font-semibold rounded-xl">
                        Join call
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-[var(--color-border)] mt-6">
                  <button 
                    type="button" 
                    onClick={handleCreateNewInstead}
                    className="text-xs text-slate-500 hover:text-indigo-600 hover:underline flex items-center justify-center gap-1.5 mx-auto font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create a new session instead
                  </button>
                </div>
              </Card>
            )}
          </div>

          {/* Right panel: Recent sessions list (2 columns) */}
          <div className="md:col-span-2 flex flex-col">
            <Card className="p-6 border-[var(--color-border)] shadow-lg bg-[var(--color-surface)]/85 backdrop-blur-md rounded-2xl flex-1 flex flex-col min-h-[350px]">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[var(--color-text)] flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" /> Recent Sessions
                </h2>
                <p className="text-muted text-sm mt-1">Manage and trace your calling history.</p>
              </div>

              {history.length > 0 ? (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 flex-1">
                  {history.slice(0, 8).map((s) => (
                    <Link 
                      key={s.id} 
                      href={s.status === 'ACTIVE' ? `/call/${s.id}` : `/summary/${s.id}`} 
                      className={cn(
                        "block p-4 border border-[var(--color-border)] rounded-xl hover:border-indigo-500/50 hover:shadow-md transition-all duration-300 bg-[var(--color-surface)]/50",
                        s.status === 'ACTIVE' && "border-emerald-500 bg-emerald-500/5 shadow-sm shadow-emerald-500/5"
                      )}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                              s.status === 'ACTIVE' 
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" 
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              {s.status.toLowerCase()}
                            </span>
                            {s.status === 'ACTIVE' && (
                              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1">
                                <LogIn className="w-3 h-3" /> Join Live
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(s.startedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-muted pt-2 border-t border-[var(--color-border)]/40">
                          <span className="font-mono">ID: {s.id.slice(0, 8)}...</span>
                          <span>{s._count?.messages || 0} messages</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[var(--color-border)] rounded-xl bg-slate-50/50 dark:bg-slate-900/10">
                  <History className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-500">No session history yet</p>
                  <p className="text-xs text-muted mt-1">Sessions you create will appear here.</p>
                </div>
              )}
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}

