'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Video, Shield, MessageSquare, ArrowRight, Radio, Users, Clock,
  Zap, CheckCircle2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeroPreview } from '@/components/HeroPreview';

export default function HomePage() {
  const [showKicked, setShowKicked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('kicked')) {
      setShowKicked(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  return (
    <div className="min-h-screen page-shell hero-mesh">
      {showKicked && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 card-elevated px-4 py-3 flex items-center gap-3 shadow-xl animate-fade-up max-w-md">
          <p className="text-sm text-[var(--color-text)]">You were removed from the call by the agent.</p>
          <button onClick={() => setShowKicked(false)} className="text-muted hover:text-[var(--color-text)]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-up">
            <div className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">SupportVision</span>
          </div>
          <div className="flex items-center gap-2 animate-fade-up animate-fade-up-delay-1">
            <ThemeToggle />
            <Link href="/admin">
              <Button variant="ghost" size="sm">Admin</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/agent">
              <Button size="sm">Start session</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6">
        {/* Hero */}
        <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          <div>
            <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200/60 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6">
              <Radio className="w-3.5 h-3.5" />
              Own your video stack — no Twilio, no Agora
            </div>

            <h1 className="animate-fade-up animate-fade-up-delay-1 text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.1] tracking-tight mb-6">
              See the problem.
              <br />
              <span className="text-shimmer">Solve it on video.</span>
            </h1>

            <p className="animate-fade-up animate-fade-up-delay-2 text-lg text-muted leading-relaxed mb-8 max-w-lg">
              Support agents share a link. Customers join in one click. Video, chat, and
              screen share run through your mediasoup server — not someone else&apos;s cloud.
            </p>

            <div className="animate-fade-up animate-fade-up-delay-3 flex flex-wrap gap-3 mb-10">
              <Link href="/agent">
                <Button size="lg" className="group">
                  Create a session
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="secondary" size="lg">Create account</Button>
              </Link>
            </div>

            <div className="animate-fade-up animate-fade-up-delay-4 flex flex-wrap gap-6 text-sm text-muted">
              {[
                { icon: CheckCircle2, text: 'Browser-only join' },
                { icon: Zap, text: '< 2s to connect' },
                { icon: Shield, text: 'Role-based access' },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-indigo-500" />
                  {text}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-fade-up animate-fade-up-delay-2 lg:pl-4">
            <HeroPreview />
          </div>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20 animate-fade-up animate-fade-up-delay-3">
          {[
            { value: 'SFU', label: 'Server-routed media' },
            { value: 'WebRTC', label: 'Browser native' },
            { value: '0', label: 'Third-party video SDKs' },
            { value: '24/7', label: 'Session history' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center hover:scale-[1.02] transition-transform duration-300">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{s.value}</p>
              <p className="text-xs text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="grid md:grid-cols-3 gap-5 pb-24">
          {[
            {
              icon: Video,
              title: 'Real SFU video',
              desc: 'mediasoup routes every stream. Agents, customers, and screen share — all through your infra.',
            },
            {
              icon: MessageSquare,
              title: 'Chat that sticks',
              desc: 'Messages and file uploads persist. Pull the full transcript after every call.',
            },
            {
              icon: Shield,
              title: 'Agents in control',
              desc: 'Create sessions, record calls, remove participants, and end when it\'s done.',
            },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className="card p-6 hover:border-indigo-300/50 dark:hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-muted text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
