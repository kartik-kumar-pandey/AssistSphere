'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Clock, Download, FileText, Loader2, MessageSquare, Mic, Users, Video, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiFetch, loadAuth, clearAuth, API_URL } from '@/lib/utils';

interface AuthData {
  token: string;
  name: string;
  sessionId: string;
  role: 'AGENT' | 'CUSTOMER';
}

interface SessionHistory {
  id: string;
  agentName: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  participants: { name: string; role: string; joinedAt: string; leftAt: string | null }[];
  messages: { senderName: string; text: string; createdAt: string; fileUrl?: string; fileName?: string; fileMime?: string }[];
  recordings: { id: string; status: string; startedAt: string; endedAt: string | null; fileUrl?: string }[];
  events: { type: string; createdAt: string }[];
}

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [session, setSession] = useState<SessionHistory | null>(null);
  const [summaryData, setSummaryData] = useState<{ summary: string; actionItems: string[] } | null>(null);
  const [messages, setMessages] = useState<SessionHistory['messages']>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const agentAuth = loadAuth<AuthData>('agentAuth');
    const customerAuth = loadAuth<AuthData>('customerAuth');

    let data: AuthData | null = null;
    if (customerAuth?.sessionId === sessionId) data = customerAuth;
    else if (agentAuth?.token) data = { ...agentAuth, sessionId };
    else if (customerAuth?.token) data = customerAuth;

    if (!data?.token) {
      router.replace('/');
      return;
    }
    setAuth(data);

    Promise.all([
      apiFetch<SessionHistory>(`/sessions/${sessionId}`, {}, data.token),
      apiFetch<{ summary: string; actionItems: string[] }>(`/sessions/${sessionId}/summary`, {}, data.token).catch(() => null),
      apiFetch<SessionHistory['messages']>(`/sessions/${sessionId}/messages`, {}, data.token).catch(() => null),
    ])
      .then(([historyRes, summaryRes, messagesRes]) => {
        setSession(historyRes);
        if (summaryRes) setSummaryData(summaryRes);
        // Use dedicated messages endpoint for most up-to-date data
        const allMessages = messagesRes && messagesRes.length > 0
          ? messagesRes
          : (historyRes?.messages ?? []);
        setMessages(allMessages);
      })
      .catch(() => router.replace('/'))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  function goHome() {
    if (auth?.role === 'AGENT') clearAuth('agentAuth');
    else clearAuth('customerAuth');
    router.push('/');
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const duration =
    session.endedAt && session.startedAt
      ? Math.round(
          (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
        )
      : null;

  return (
    <div className="min-h-screen page-shell">
      <nav className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[var(--color-text)]">AssistSphere</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>

        <div className="card-elevated p-8 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
              <Video className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Session complete</h1>
              <p className="text-muted mt-1">
                Support call with {session.agentName}
                {duration !== null && ` · ${duration} min`}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Stat icon={Users} label="Participants" value={String(session.participants.length)} />
            <Stat icon={MessageSquare} label="Messages" value={String(messages.length)} />
            <Stat icon={Clock} label="Status" value={session.status} />
          </div>
        </div>

        {session.recordings.length > 0 && (
          <section className="card p-6 mb-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500" />
              Recordings
            </h2>
            <div className="space-y-3">
              {session.recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between bg-[var(--color-surface-muted)] rounded-xl px-4 py-3 border border-[var(--color-border)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {new Date(rec.startedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted capitalize">{rec.status.toLowerCase()}</p>
                  </div>
                  {rec.status === 'READY' && auth?.role === 'AGENT' && (
                    <a
                      href={`${API_URL}/recordings/${rec.id}/download`}
                      onClick={(e) => {
                        e.preventDefault();
                        fetch(`${API_URL}/recordings/${rec.id}/download`, {
                          headers: { Authorization: `Bearer ${auth.token}` },
                        })
                          .then((r) => r.blob())
                          .then((blob) => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `recording-${rec.id}.webm`;
                            a.click();
                            URL.revokeObjectURL(url);
                          });
                      }}
                    >
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {summaryData && summaryData.summary && (
          <section className="card p-6 mb-6 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50">
            <h2 className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              AI Meeting Summary
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text)] leading-relaxed">
                {summaryData.summary}
              </p>
              {summaryData.actionItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">Action Items</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {summaryData.actionItems.map((item, i) => (
                      <li key={i} className="text-sm text-[var(--color-text)]">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="card p-6 mb-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            Chat transcript
            <span className="ml-auto text-xs text-[var(--color-text-muted)] font-normal flex items-center gap-2">
              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> chat</span>
              <span className="flex items-center gap-1"><Mic className="w-3 h-3 text-violet-400" /> voice</span>
            </span>
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="text-slate-500 text-sm">No messages in this session.</p>
            ) : (
              messages.map((msg, i) => {
                const isTranscript = (msg as any).fileMime === 'transcript';
                return (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm border ${
                      isTranscript
                        ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40'
                        : 'bg-[var(--color-surface-muted)] border-[var(--color-border)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isTranscript ? (
                        <Mic className="w-3 h-3 text-violet-500 shrink-0" />
                      ) : (
                        <MessageSquare className="w-3 h-3 text-indigo-500 shrink-0" />
                      )}
                      <span className={`font-semibold text-xs ${
                        isTranscript ? 'text-violet-500' : 'text-indigo-500'
                      }`}>{msg.senderName}</span>
                      <span className="text-[var(--color-text-muted)] text-xs">·</span>
                      <span className="text-[var(--color-text-muted)] text-xs">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isTranscript && (
                        <span className="ml-auto text-[10px] text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full font-medium">
                          voice
                        </span>
                      )}
                    </div>
                    <span className={`text-[var(--color-text)] ${
                      isTranscript ? 'italic' : ''
                    }`}>{msg.text}</span>
                    {msg.fileUrl && (
                      <a
                        href={`${API_URL.replace('/api', '')}${msg.fileUrl}`}
                        className="block text-xs text-indigo-500 underline mt-1"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {msg.fileName || 'Attachment'}
                      </a>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="card p-6 mb-8">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Participants
          </h2>
          <ul className="space-y-2">
            {session.participants.map((p, i) => (
              <li
                key={i}
                className="flex justify-between text-sm bg-[var(--color-surface-muted)] rounded-lg px-3 py-2 border border-[var(--color-border)]"
              >
                <span className="text-[var(--color-text)]">{p.name}</span>
                <span className="text-muted capitalize">{p.role.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>

        <Button onClick={goHome} className="w-full" size="lg">
          Return home
        </Button>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--color-surface-muted)] rounded-xl p-4 text-center border border-[var(--color-border)]">
      <Icon className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
      <p className="text-2xl font-bold text-[var(--color-text)]">{value}</p>
      <p className="text-xs text-muted uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
