'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Shield, Activity, Users, Clock, Trash2,
  MessageSquare, FileText, RefreshCw, Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { apiFetch, saveAuth, loadAuth, clearAuth } from '@/lib/utils';

interface Session {
  id: string;
  status: string;
  agentName?: string;
  startedAt: string;
  endedAt?: string;
  inviteToken: string;
  participants: { id: string; name: string; role: string; joinedAt: string; leftAt?: string; durationSec?: number }[];
  _count?: { messages: number; files: number };
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveSessions, setLiveSessions] = useState<Session[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetail, setSessionDetail] = useState<object | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const saved = loadAuth<{ token: string }>('adminAuth');
    if (saved?.token) setToken(saved.token);
  }, []);

  const fetchData = useCallback(async (authToken: string) => {
    setRefreshing(true);
    try {
      const [live, hist] = await Promise.all([
        apiFetch<Session[]>('/admin/sessions/live', {}, authToken),
        apiFetch<Session[]>('/admin/sessions', {}, authToken),
      ]);
      setLiveSessions(live);
      setHistory(hist);
    } catch {
      setToken(null);
      clearAuth('adminAuth');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchData(token);
    const interval = setInterval(() => fetchData(token), 10000);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ token: string }>('/auth/admin', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      saveAuth('adminAuth', { token: data.token });
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function forceEnd(sessionId: string) {
    if (!token || !confirm('Force end this session?')) return;
    await apiFetch(`/admin/sessions/${sessionId}`, { method: 'DELETE' }, token);
    fetchData(token);
  }

  async function viewDetail(session: Session) {
    if (!token) return;
    setSelectedSession(session);
    const detail = await apiFetch<{
      participants: Session['participants'];
      messages: { senderName: string; text: string; createdAt: string }[];
      events: { type: string; createdAt: string }[];
    }>(`/sessions/${session.id}`, {}, token);
    setSessionDetail(detail);
  }

  function formatDuration(start: string, end?: string) {
    const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f0f4f8]">
        <div className="max-w-md mx-auto px-6 py-20">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
          </div>
          <Card glow>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" loading={loading} className="w-full">Sign in</Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-500 hover:text-indigo-600"><ArrowLeft className="w-5 h-5" /></Link>
            <Shield className="w-6 h-6 text-indigo-600" />
            <h1 className="text-lg font-bold text-slate-900">Admin dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => token && fetchData(token)} loading={refreshing}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Live sessions */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-slate-900">Live sessions ({liveSessions.length})</h2>
          </div>
          {liveSessions.length === 0 ? (
            <Card className="text-center text-slate-500 py-8">No active sessions</Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveSessions.map((s) => (
                <Card key={s.id} className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{s.agentName || 'Unknown agent'}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.id.slice(0, 12)}...</p>
                    </div>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-100">
                      <Activity className="w-3 h-3" /> Live
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" />{s.participants.length}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatDuration(s.startedAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => viewDetail(s)}>Details</Button>
                    <Button variant="danger" size="sm" onClick={() => forceEnd(s.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Session history</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="text-left p-4">Agent</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Participants</th>
                  <th className="text-left p-4">Messages</th>
                  <th className="text-left p-4">Duration</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="p-4 text-slate-900">{s.agentName || '—'}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700">{s.participants.length}</td>
                    <td className="p-4 text-slate-700">{s._count?.messages ?? 0}</td>
                    <td className="p-4 text-slate-700">{formatDuration(s.startedAt, s.endedAt)}</td>
                    <td className="p-4">
                      <Button variant="ghost" size="sm" onClick={() => viewDetail(s)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Session detail modal */}
        {selectedSession && sessionDetail && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Session details</h3>
                <button onClick={() => { setSelectedSession(null); setSessionDetail(null); }}>
                  <ArrowLeft className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {'participants' in (sessionDetail as object) && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Participants
                    </h4>
                    {(sessionDetail as { participants: Session['participants'] }).participants.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm py-2 border-b border-slate-100">
                        <span className="text-slate-900">{p.name} ({p.role})</span>
                        <span className="text-slate-500">{p.durationSec ? `${p.durationSec}s` : 'Active'}</span>
                      </div>
                    ))}
                  </div>

                  {'messages' in (sessionDetail as object) && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Messages
                      </h4>
                      {(sessionDetail as { messages: { senderName: string; text: string; createdAt: string }[] }).messages.slice(0, 10).map((m, i) => (
                        <div key={i} className="text-sm py-1">
                          <span className="text-indigo-600 font-medium">{m.senderName}:</span>{' '}
                          <span className="text-slate-700">{m.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {'events' in (sessionDetail as object) && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Events
                      </h4>
                      {(sessionDetail as { events: { type: string; createdAt: string }[] }).events.map((e, i) => (
                        <div key={i} className="text-xs text-slate-500 py-1">{e.type} — {new Date(e.createdAt).toLocaleString()}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Metrics link */}
        <Card className="text-center">
          <p className="text-slate-500 text-sm mb-2">Prometheus metrics available at</p>
          <code className="text-indigo-600 text-sm bg-indigo-50 px-2 py-1 rounded">http://localhost:4000/metrics</code>
        </Card>
      </main>
    </div>
  );
}
