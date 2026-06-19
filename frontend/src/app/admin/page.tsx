'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Shield, Activity, Users, Clock, Trash2,
  MessageSquare, FileText, RefreshCw, Radio,
  BarChart3, PieChart as PieChartIcon, Palette, ImageIcon, Save
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { apiFetch, saveAuth, loadAuth, clearAuth, cn } from '@/lib/utils';
import { useBranding } from '@/components/BrandingProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  const { refreshBranding } = useBranding();
  const [brandingForm, setBrandingForm] = useState({
    appName: 'AssistSphere',
    primaryColor: '#4f46e5',
    primaryHover: '#4338ca',
    logoUrl: '',
    logoDarkUrl: '',
  });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState('');

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
    loadBranding(token);
    const interval = setInterval(() => fetchData(token), 10000);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  async function loadBranding(authToken: string) {
    try {
      const data = await apiFetch<typeof brandingForm>('/admin/branding', {}, authToken);
      setBrandingForm({
        appName: data.appName,
        primaryColor: data.primaryColor,
        primaryHover: data.primaryHover,
        logoUrl: data.logoUrl || '',
        logoDarkUrl: data.logoDarkUrl || '',
      });
    } catch {
      // keep defaults
    }
  }

  async function saveBranding() {
    if (!token) return;
    setBrandingSaving(true);
    setBrandingMsg('');
    try {
      await apiFetch('/admin/branding', {
        method: 'PUT',
        body: JSON.stringify({
          appName: brandingForm.appName,
          primaryColor: brandingForm.primaryColor,
          primaryHover: brandingForm.primaryHover,
          logoUrl: brandingForm.logoUrl || null,
          logoDarkUrl: brandingForm.logoDarkUrl || null,
        }),
      }, token);
      await refreshBranding();
      setBrandingMsg('Branding saved — updates apply across the app.');
    } catch (err) {
      setBrandingMsg(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setBrandingSaving(false);
    }
  }

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

  // --- Chart Data Calculations ---
  const endedHistoryCount = history.filter(s => s.status === 'ENDED').length;
  
  const pieData = [
    { name: 'Active Sessions', value: liveSessions.length, color: '#10b981' }, // emerald-500
    { name: 'Ended Sessions', value: endedHistoryCount, color: '#94a3b8' } // slate-400
  ];

  const barData = useMemo(() => {
    return history.slice(0, 10).map(s => {
      let durationMins = 0;
      if (s.endedAt) {
        durationMins = Math.floor((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000);
      } else {
        durationMins = Math.floor((new Date().getTime() - new Date(s.startedAt).getTime()) / 60000);
      }
      return {
        name: s.agentName || s.id.slice(0, 4),
        participants: s.participants.length,
        duration: durationMins,
      };
    }).reverse();
  }, [history]);

  const totalParticipantsAllTime = useMemo(() => {
    return history.reduce((acc, s) => acc + s.participants.length, 0);
  }, [history]);

  if (!token) {
    return (
      <div className="min-h-screen page-shell flex flex-col justify-center hero-mesh relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-white/20 dark:from-indigo-950/30 dark:to-black/20 pointer-events-none" />
        <div className="max-w-md w-full mx-auto px-6 py-20 relative z-10 animate-fade-up">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex flex-col items-center gap-3 mb-10 text-center">
            <div className="w-16 h-16 rounded-2xl btn-primary flex items-center justify-center mb-2 shadow-xl shadow-indigo-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-text)]">Admin Console</h1>
            <p className="text-muted text-sm">Secure access to operations dashboard</p>
          </div>
          <Card className="p-8 shadow-2xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-white/20 dark:border-white/10">
            <form onSubmit={handleLogin} className="space-y-5">
              <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <p className="text-red-500 text-sm font-medium animate-pulse">{error}</p>}
              <Button type="submit" loading={loading} className="w-full h-12 text-md">Authenticate</Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell hero-mesh pb-20">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 animate-fade-up">
            <Link href="/" className="text-muted hover:text-indigo-600 transition-colors p-2 -ml-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-lg font-bold text-[var(--color-text)] tracking-tight">Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex gap-3 animate-fade-up animate-fade-up-delay-1">
             <Button variant="secondary" size="sm" onClick={() => { setToken(null); clearAuth('adminAuth'); }}>Sign Out</Button>
             <Button size="sm" onClick={() => token && fetchData(token)} loading={refreshing} className="shadow-md shadow-indigo-500/20">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-up animate-fade-up-delay-1">
          <Card className="p-6 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Radio className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">Total Sessions</p>
              <h3 className="text-3xl font-bold">{history.length}</h3>
            </div>
          </Card>
          <Card className="p-6 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">Active Live Sessions</p>
              <h3 className="text-3xl font-bold">{liveSessions.length}</h3>
            </div>
          </Card>
          <Card className="p-6 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">Total Participants Served</p>
              <h3 className="text-3xl font-bold">{totalParticipantsAllTime}</h3>
            </div>
          </Card>
        </section>

        {/* Branding settings */}
        <section className="animate-fade-up animate-fade-up-delay-2">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-[var(--color-text)]">Custom Branding</h2>
          </div>
          <Card className="p-6 border border-[var(--color-border)] shadow-sm">
            <p className="text-sm text-muted mb-6">
              Set your primary colors and logo URLs. Changes are stored in PostgreSQL and applied app-wide.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input
                  label="App name"
                  value={brandingForm.appName}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, appName: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Primary color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandingForm.primaryColor}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, primaryColor: e.target.value }))}
                        className="w-12 h-10 rounded-lg border border-[var(--color-border)] cursor-pointer"
                      />
                      <Input
                        value={brandingForm.primaryColor}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, primaryColor: e.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Primary hover</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandingForm.primaryHover}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, primaryHover: e.target.value }))}
                        className="w-12 h-10 rounded-lg border border-[var(--color-border)] cursor-pointer"
                      />
                      <Input
                        value={brandingForm.primaryHover}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, primaryHover: e.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
                <Input
                  label="Logo URL (light mode)"
                  placeholder="https://example.com/logo.png"
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, logoUrl: e.target.value }))}
                />
                <Input
                  label="Logo URL (dark mode, optional)"
                  placeholder="https://example.com/logo-dark.png"
                  value={brandingForm.logoDarkUrl}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, logoDarkUrl: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Preview</p>
                <div className="rounded-2xl border border-[var(--color-border)] p-6 bg-[var(--color-surface-muted)] flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden text-white font-bold"
                      style={{ background: `linear-gradient(135deg, ${brandingForm.primaryHover}, ${brandingForm.primaryColor})` }}
                    >
                      {brandingForm.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brandingForm.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5" />
                      )}
                    </div>
                    <span className="text-lg font-bold">{brandingForm.appName || 'AssistSphere'}</span>
                  </div>
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm w-fit"
                    style={{ background: `linear-gradient(135deg, ${brandingForm.primaryHover}, ${brandingForm.primaryColor})` }}
                  >
                    Sample button
                  </button>
                </div>
                <Button onClick={saveBranding} loading={brandingSaving} className="w-fit">
                  <Save className="w-4 h-4" />
                  Save branding
                </Button>
                {brandingMsg && (
                  <p className={cn('text-sm', brandingMsg.includes('Failed') ? 'text-red-500' : 'text-emerald-600')}>
                    {brandingMsg}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* Charts Row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up animate-fade-up-delay-2">
           <Card className="p-6 lg:col-span-2 flex flex-col border border-[var(--color-border)] shadow-sm">
             <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold">Recent Sessions Overview</h3>
             </div>
             <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} dy={10} />
                   <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
                   <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                     cursor={{ fill: 'var(--color-primary-soft)', opacity: 0.4 }}
                   />
                   <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                   <Bar yAxisId="left" dataKey="duration" name="Duration (min)" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={32} />
                   <Bar yAxisId="left" dataKey="participants" name="Participants" fill="#c084fc" radius={[4, 4, 0, 0]} barSize={32} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </Card>

           <Card className="p-6 flex flex-col border border-[var(--color-border)] shadow-sm">
             <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold">Session Status</h3>
             </div>
             <div className="flex-1 w-full min-h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={pieData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={90}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {pieData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                   <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                     itemStyle={{ color: 'var(--color-text)' }}
                   />
                   <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px' }} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           </Card>
        </section>

        {/* Live sessions */}
        <section className="animate-fade-up animate-fade-up-delay-3">
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">Live Monitoring ({liveSessions.length})</h2>
          </div>
          {liveSessions.length === 0 ? (
            <Card className="text-center py-12 border-dashed bg-slate-50/50 dark:bg-slate-900/20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                 <Activity className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium mb-1">No active sessions</h3>
              <p className="text-muted text-sm max-w-sm mx-auto">When agents start new support sessions, they will appear here in real-time.</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {liveSessions.map((s) => (
                <Card key={s.id} className="p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-600/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-bold text-[var(--color-text)] text-lg">{s.agentName || 'Unknown Agent'}</p>
                        <p className="text-xs text-muted font-mono mt-0.5 opacity-70">{s.id}</p>
                      </div>
                      <span className="text-xs bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                       <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2.5 flex items-center gap-2">
                         <Users className="w-4 h-4 text-indigo-500" />
                         <span className="text-sm font-medium">{s.participants.length} <span className="text-muted font-normal text-xs">users</span></span>
                       </div>
                       <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2.5 flex items-center gap-2">
                         <Clock className="w-4 h-4 text-amber-500" />
                         <span className="text-sm font-medium">{formatDuration(s.startedAt)}</span>
                       </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
                    <Button variant="secondary" size="sm" className="flex-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => viewDetail(s)}>Details</Button>
                    <Button variant="danger" size="sm" className="px-3" onClick={() => forceEnd(s.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section className="animate-fade-up animate-fade-up-delay-4">
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-6">Historical Data</h2>
          <Card className="overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-slate-50 dark:bg-slate-900/50 text-muted">
                    <th className="text-left p-4 font-semibold">Agent</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Participants</th>
                    <th className="text-left p-4 font-semibold">Messages</th>
                    <th className="text-left p-4 font-semibold">Duration</th>
                    <th className="text-left p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {history.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-medium">{s.agentName || '—'}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1.5 ${
                          s.status === 'ACTIVE' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {s.status === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium">{s.participants.length}</span></td>
                      <td className="p-4 text-muted">{s._count?.messages ?? 0}</td>
                      <td className="p-4 text-muted font-mono text-xs">{formatDuration(s.startedAt, s.endedAt)}</td>
                      <td className="p-4">
                        <Button variant="ghost" size="sm" onClick={() => viewDetail(s)} className="h-8">View log</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Session detail modal */}
        {selectedSession && sessionDetail && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-up">
            <Card className="max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border-white/10 flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface)] z-10">
                <div>
                  <h3 className="text-xl font-bold text-[var(--color-text)]">Session Log</h3>
                  <p className="text-sm text-muted font-mono mt-1">{selectedSession.id}</p>
                </div>
                <button onClick={() => { setSelectedSession(null); setSessionDetail(null); }} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-muted" />
                </button>
              </div>

              <div className="p-6">
                {'participants' in (sessionDetail as object) && (
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Participants
                      </h4>
                      <div className="grid gap-3">
                        {(sessionDetail as { participants: Session['participants'] }).participants.map((p) => (
                          <div key={p.id} className="flex justify-between items-center text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-[var(--color-border)]">
                            <div>
                              <span className="font-semibold text-[var(--color-text)]">{p.name}</span>
                              <span className="text-xs ml-2 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400">{p.role}</span>
                            </div>
                            <span className="text-muted font-mono text-xs">{p.durationSec ? `${p.durationSec}s` : 'Active'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {'messages' in (sessionDetail as object) && (
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" /> Chat Transcript
                        </h4>
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-[var(--color-border)]">
                          {(sessionDetail as { messages: { senderName: string; text: string; createdAt: string }[] }).messages.length === 0 ? (
                             <p className="text-muted text-sm italic">No messages in this session.</p>
                          ) : (
                             (sessionDetail as { messages: { senderName: string; text: string; createdAt: string }[] }).messages.slice(0, 20).map((m, i) => (
                              <div key={i} className="text-sm">
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-2">{m.senderName}</span>
                                <span className="text-[var(--color-text)] bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg rounded-tl-none inline-block shadow-sm border border-[var(--color-border)] mt-1">{m.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {'events' in (sessionDetail as object) && (
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Event Timeline
                        </h4>
                        <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-4">
                          {(sessionDetail as { events: { type: string; createdAt: string }[] }).events.map((e, i) => (
                            <div key={i} className="relative">
                              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-900" />
                              <p className="text-sm font-medium text-[var(--color-text)]">{e.type}</p>
                              <p className="text-xs text-muted mt-0.5">{new Date(e.createdAt).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Metrics link */}
        <div className="flex justify-center pt-8 pb-4 animate-fade-up animate-fade-up-delay-4">
          <div className="inline-flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-center">
            <Activity className="w-6 h-6 text-indigo-500 mb-1" />
            <p className="text-indigo-900/80 dark:text-indigo-200/70 text-sm font-medium">Export raw monitoring data</p>
            <a href="http://localhost:4000/metrics" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-mono text-xs bg-white dark:bg-indigo-950 px-3 py-1.5 rounded-lg shadow-sm hover:underline transition-all">
              /metrics endpoint
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
