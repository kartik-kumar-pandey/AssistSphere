'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Video, Shield, MessageSquare, ArrowRight, Radio, Users, Clock,
  Zap, CheckCircle2, X, Sparkles, Smile, Code, HelpCircle, HardDrive, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeroPreview } from '@/components/HeroPreview';
import { BrandLogo } from '@/components/BrandLogo';
import { Card } from '@/components/ui/Card';
import { FloatingStickers, createFloatingSticker, type FloatingStickerItem } from '@/components/FloatingStickers';

export default function HomePage() {
  const [showKicked, setShowKicked] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'screenshare' | 'summary' | 'observability'>('video');
  const [floatingStickers, setFloatingStickers] = useState<FloatingStickerItem[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('kicked')) {
      setShowKicked(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const triggerReaction = (emoji: string) => {
    setFloatingStickers((prev) => [
      ...prev,
      createFloatingSticker('Guest User', emoji, {
        streamKey: 'demo',
        isLocal: true,
      }),
    ]);
  };

  const removeFloatingSticker = (id: string) => {
    setFloatingStickers((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen page-shell hero-mesh flex flex-col justify-between">
      {showKicked && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 card-elevated px-4 py-3 flex items-center gap-3 shadow-xl animate-fade-up max-w-md">
          <p className="text-sm text-[var(--color-text)]">You were removed from the call by the agent.</p>
          <button onClick={() => setShowKicked(false)} className="text-muted hover:text-[var(--color-text)]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="animate-fade-up">
              <BrandLogo />
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
                <Button size="sm" className="btn-primary">Start session</Button>
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
                screen share run through your self-hosted mediasoup server — backed by secure OCI Object Storage.
              </p>

              <div className="animate-fade-up animate-fade-up-delay-3 flex flex-wrap gap-3 mb-10">
                <Link href="/agent">
                  <Button size="lg" className="group btn-primary">
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

          {/* Interactive Feature Simulator */}
          <section className="mb-24 animate-fade-up">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-3xl font-bold tracking-tight mb-3">Experience the Interface</h2>
              <p className="text-muted text-sm">Explore how AssistSphere handles calls, screenshares, post-call analytics, and real-time backend observability.</p>
            </div>

            <div className="grid lg:grid-cols-4 gap-6 items-start">
              {/* Tabs selector */}
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                {[
                  { id: 'video', label: 'Call Screen Grid', icon: Video, desc: 'Responsive Grid layout' },
                  { id: 'screenshare', label: 'Presentation Stage', icon: Sparkles, desc: '75%/25% screen split' },
                  { id: 'summary', label: 'Post-Call Logs', icon: MessageSquare, desc: 'Transcripts & recording' },
                  { id: 'observability', label: 'Observability', icon: BarChart3, desc: 'Metrics & Exporters' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-300 border ${
                      activeTab === t.id 
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-slate-50 dark:hover:bg-slate-900/50 text-muted'
                    }`}
                  >
                    <t.icon className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[10px] opacity-70 font-normal hidden lg:block">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Tab Display Panel */}
              <Card className="lg:col-span-3 p-6 min-h-[380px] flex flex-col justify-between border-[var(--color-border)] shadow-md relative overflow-hidden bg-[var(--color-surface)]/80 backdrop-blur-md">
                {activeTab === 'video' && (
                  <div className="space-y-4 animate-fade-up">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm">Interactive Grid Simulator</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full font-bold">2 Connected</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 h-64">
                      <div className="rounded-xl bg-slate-900 flex flex-col justify-between p-4 relative overflow-hidden border-2 border-indigo-500 animate-speaker-wave">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        <div className="z-10 flex justify-between items-center">
                          <span className="text-xs bg-slate-800/80 text-white px-2 py-0.5 rounded-full backdrop-blur-md">Agent Kartik</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                        </div>
                        <div className="z-10 text-center text-xs text-white/50 py-10">
                          Camera Active (mediasoup Consumer)
                        </div>
                        <div className="z-10 flex justify-between items-center text-xs text-white">
                          <span>Speaking...</span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-900 flex flex-col justify-between p-4 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        <div className="z-10 flex justify-between items-center">
                          <span className="text-xs bg-slate-800/80 text-white px-2 py-0.5 rounded-full backdrop-blur-md">Customer Support</span>
                        </div>
                        <div className="z-10 text-center text-xs text-white/50 py-10">
                          Remote Stream (mediasoup Producer)
                        </div>
                        <div className="z-10 text-xs text-white">
                          <span>Muted</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'screenshare' && (
                  <div className="space-y-4 animate-fade-up">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm">Presentation Stage (75% / 25% Split Screen)</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full font-bold">Screen Share Active</span>
                    </div>
                    <div className="flex gap-4 h-64">
                      {/* 75% stage */}
                      <div className="flex-1 rounded-xl bg-indigo-950 flex flex-col justify-between p-4 border border-indigo-500/30">
                        <div className="text-center text-xs text-indigo-200/60 py-12 flex flex-col items-center gap-2">
                          <Code className="w-10 h-10 text-indigo-400" />
                          <span>Screen Share stream from Agent browser</span>
                        </div>
                        <span className="text-xs bg-black/40 text-white px-2 py-0.5 rounded-full w-fit">Kartik&apos;s Screen</span>
                      </div>
                      {/* 25% sidebar */}
                      <div className="w-1/4 flex flex-col gap-2">
                        <div className="flex-1 rounded-xl bg-slate-900 p-2 text-center text-[10px] text-white/50 flex items-center justify-center border border-white/10">Agent Video</div>
                        <div className="flex-1 rounded-xl bg-slate-900 p-2 text-center text-[10px] text-white/50 flex items-center justify-center border border-white/10">User Camera</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'summary' && (
                  <div className="space-y-4 animate-fade-up">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm">Post-Call Session Summary Page</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full font-bold">Session ended</span>
                    </div>
                    <div className="space-y-3 bg-[var(--color-surface-muted)] p-4 rounded-xl border border-[var(--color-border)] h-48 overflow-y-auto">
                      <div className="text-xs">
                        <span className="font-bold text-indigo-500">Agent Kartik:</span> Let me check your setup on screen.
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-indigo-500">User:</span> Sounds good! I can see your video.
                      </div>
                      <div className="text-xs border-t border-[var(--color-border)] pt-2 mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted">Session Transcript Complete</span>
                        <Button size="sm" className="h-7 text-[10px] px-2 py-0">Download encrypted recording (.webm)</Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'observability' && (
                  <div className="space-y-4 animate-fade-up">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm">Observability & Metrics Monitoring</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full font-bold">Prometheus Active</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-white/10 h-48 flex flex-col justify-between font-mono text-xs text-amber-500">
                      <div>
                        <p># HELP active_connections The total number of active connections</p>
                        <p># TYPE active_connections gauge</p>
                        <p className="text-white">active_connections 2</p>
                        <br />
                        <p># HELP room_participants_total Active participants in calling rooms</p>
                        <p className="text-white">room_participants_total{`{room="support_session"}`} 2</p>
                      </div>
                      <span className="text-[10px] text-muted self-end">Scraped by Prometheus on port 9100</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-muted">
                  <span>Architecture: Node.js + mediasoup + Oracle VM instance</span>
                  <Link href="/agent" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                    Try active calling room <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </Card>
            </div>
          </section>

          {/* Emoji Sandbox */}
          <section className="mb-24 grid lg:grid-cols-5 gap-8 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100/80 text-pink-700 dark:bg-pink-950/20 dark:text-pink-400 text-xs font-semibold">
                <Smile className="w-3.5 h-3.5" /> Emoji Reactions
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Floating Sticker Sandbox</h2>
              <p className="text-muted text-sm leading-relaxed">
                Interact with the sandbox by clicking the reaction triggers. 
                These reactions use the same animation engine built for our real-time mediasoup call UI.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {['👍', '🎉', '🔥', '❤️', '👏', '😮'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => triggerReaction(emoji)}
                    className="w-12 h-12 text-2xl flex items-center justify-center rounded-xl bg-[var(--color-surface)] hover:bg-indigo-500 hover:text-white transition-all duration-300 shadow-sm border border-[var(--color-border)] hover:scale-105 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Sandbox screen */}
            <div className="lg:col-span-3 card h-[450px] relative overflow-hidden bg-slate-900 border-2 border-indigo-500/20 flex flex-col justify-between p-6">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              <div className="z-10 flex justify-between items-center">
                <span className="text-xs bg-slate-800/80 text-white px-2 py-0.5 rounded-full backdrop-blur-md">Sticker Reaction Sandbox</span>
                <span className="text-[10px] text-white/50 font-mono">Status: Interactive</span>
              </div>

              {/* Floating stickers container */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
                <FloatingStickers items={floatingStickers} onDone={removeFloatingSticker} />
              </div>

              <div className="z-10 text-center text-xs text-white/40 border border-white/5 bg-white/5 backdrop-blur-md rounded-xl p-4 py-8 self-center max-w-sm pointer-events-none">
                Sticker stream responds to socket events. Click one of the emoji buttons to trigger reaction particles.
              </div>

              <div className="z-10 flex justify-between items-center text-xs text-white/60">
                <span>mediasoup SFU Channel</span>
                <span>Active</span>
              </div>
            </div>
          </section>

          {/* Comparison */}
          <section className="mb-24">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-xs font-semibold mb-3">
                <HardDrive className="w-3.5 h-3.5" /> Self-Hosted Benefits
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Self-Hosted vs. Third-Party APIs</h2>
              <p className="text-muted text-sm">Compare the benefits of owning your calling infrastructure vs relying on third-party SaaS SDK providers.</p>
            </div>

            <Card className="overflow-hidden border-[var(--color-border)] shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-slate-50 dark:bg-slate-900/50 text-muted">
                      <th className="text-left p-4 font-semibold">Capability</th>
                      <th className="text-left p-4 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/10">AssistSphere (Self-Hosted)</th>
                      <th className="text-left p-4 font-semibold">Third-Party SaaS (Agora, Twilio)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {[
                      { cap: 'Cost Model', self: '100% Free (Oracle Cloud Compute)', other: 'Usage-based ($0.004 per user/minute)' },
                      { cap: 'Data Privacy', self: 'Encrypted locally, uploaded to OCI bucket', other: 'Stored in US/3rd-party servers' },
                      { cap: 'Customization', self: 'Full control over layouts & media routing', other: 'Locked UI SDKs, limited hooks' },
                      { cap: 'Telemetry / Logs', self: 'Native Prometheus metrics exporters', other: 'Paid enterprise dashboard add-ons' }
                    ].map(r => (
                      <tr key={r.cap} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 font-bold text-[var(--color-text)]">{r.cap}</td>
                        <td className="p-4 bg-indigo-50/10 dark:bg-indigo-950/5 font-medium text-[var(--color-text)]">{r.self}</td>
                        <td className="p-4 text-muted">{r.other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Features */}
          <section className="grid md:grid-cols-3 gap-5 pb-24 border-t border-[var(--color-border)] pt-16">
            {[
              {
                icon: Video,
                title: 'Real SFU video',
                desc: 'mediasoup routes every stream. Agents, customers, and screen share — all through your infra.',
              },
              {
                icon: MessageSquare,
                title: 'Chat that sticks',
                desc: 'Messages and file uploads persist. Full WebM call recordings encrypted and stored securely.',
              },
              {
                icon: Shield,
                title: 'Agents in control',
                desc: 'Create sessions, record calls, remove participants, and end when it\'s done.',
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="card p-6 hover:border-indigo-300/50 dark:hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1"
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

      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/80 py-12 text-sm">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 space-y-4">
            <BrandLogo />
            <p className="text-muted text-xs leading-relaxed max-w-sm">
              Custom self-hosted WebRTC calling platform designed for secure customer support teams. Built using Next.js 15, Node.js, and mediasoup SFU.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text)] mb-4">Dashboard</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/agent" className="text-muted hover:text-indigo-500 transition-colors">Start call</Link>
              </li>
              <li>
                <Link href="/login" className="text-muted hover:text-indigo-500 transition-colors">Agent login</Link>
              </li>
              <li>
                <Link href="/admin" className="text-muted hover:text-indigo-500 transition-colors">Admin console</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text)] mb-4">Project</h4>
            <ul className="space-y-2">
              <li>
                <Link href="https://github.com/kartik-kumar-pandey/AtomQuest-Hackathon-finale" target="_blank" className="text-muted hover:text-indigo-500 transition-colors">GitHub Repository</Link>
              </li>
              <li>
                <span className="text-muted opacity-50">AtomQuest Hackathon 1.0</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 mt-8 pt-8 border-t border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted">
          <span>&copy; 2026 AssistSphere. All rights reserved.</span>
          <span>Designed & Built for secure enterprise communications.</span>
        </div>
      </footer>
    </div>
  );
}
