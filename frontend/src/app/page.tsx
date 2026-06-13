'use client';

import Link from 'next/link';
import { Video, Shield, MessageSquare, Headphones, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px]" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
            <Video className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="text-xl font-bold tracking-tight">SupportVision</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm">Admin</Button>
          </Link>
          <Link href="/agent">
            <Button size="sm">Agent Portal</Button>
          </Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-indigo-300 mb-8">
            <Sparkles className="w-4 h-4" />
            Server-routed video · Zero third-party SDKs
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
            Video support that{' '}
            <span className="gradient-text">actually works</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Help customers visually — share screens, troubleshoot devices, and resolve issues
            faster with real-time video calls routed through your own infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/agent">
              <Button size="lg" className="min-w-[200px]">
                Start as Agent
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <p className="text-sm text-slate-500">
              Customers join via invite link — no app needed
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-24">
          {[
            {
              icon: Video,
              title: 'Server-Routed Media',
              desc: 'All audio & video flows through mediasoup SFU — no peer-to-peer, full control.',
            },
            {
              icon: MessageSquare,
              title: 'In-Call Chat',
              desc: 'Real-time messaging with file sharing, persisted for every session record.',
            },
            {
              icon: Shield,
              title: 'Role-Based Access',
              desc: 'Agents create sessions. Customers join via secure invite tokens only.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-6 hover:bg-white/[0.07] transition-colors">
              <div className="p-3 rounded-xl bg-indigo-600/20 w-fit mb-4">
                <Icon className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-24 glass rounded-3xl p-8 md:p-12 text-center">
          <Headphones className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to assist your customers?</h2>
          <p className="text-slate-400 mb-6">Create a session in seconds and share the invite link.</p>
          <Link href="/agent">
            <Button size="lg">Get Started Free</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
