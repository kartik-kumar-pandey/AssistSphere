'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Clock, Download, FileText, Loader2, MessageSquare, Users, Video,
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
  messages: { senderName: string; text: string; createdAt: string; fileUrl?: string; fileName?: string }[];
  recordings: { id: string; status: string; startedAt: string; endedAt: string | null; fileUrl?: string }[];
  events: { type: string; createdAt: string }[];
}

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [session, setSession] = useState<SessionHistory | null>(null);
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

    apiFetch<SessionHistory>(`/sessions/${sessionId}`, {}, data.token)
      .then(setSession)
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
            <Stat icon={MessageSquare} label="Messages" value={String(session.messages.length)} />
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

        <section className="card p-6 mb-6">
          <h2 className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            Chat transcript
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {session.messages.length === 0 ? (
              <p className="text-slate-500 text-sm">No messages in this session.</p>
            ) : (
              session.messages.map((msg, i) => (
                <div
                  key={i}
                  className="bg-[var(--color-surface-muted)] rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]"
                >
                  <span className="text-indigo-500 font-medium">{msg.senderName}: </span>
                  <span className="text-[var(--color-text)]">{msg.text}</span>
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
              ))
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
