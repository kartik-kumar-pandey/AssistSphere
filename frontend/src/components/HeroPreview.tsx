'use client';

import { MessageSquare, Mic, MonitorUp, Users } from 'lucide-react';

export function HeroPreview() {
  return (
    <div className="relative animate-float-slow">
      <div className="absolute -inset-4 rounded-3xl bg-indigo-500/10 dark:bg-indigo-500/20 blur-2xl animate-pulse-ring" />

      <div className="relative card-elevated overflow-hidden shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-900/30">
        {/* Fake window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="text-[10px] text-muted font-mono ml-2">supportvision.app/call/live</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        <div className="p-3 grid grid-cols-3 gap-2 bg-[var(--color-surface-muted)]">
          <div className="col-span-2 aspect-video rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_40%,rgba(255,255,255,0.03)_50%,transparent_60%)]" />
            <div className="absolute bottom-2 left-2 text-[10px] text-white/90 font-medium bg-black/40 px-2 py-0.5 rounded-md">
              Agent · Sarah
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex-1 rounded-xl bg-gradient-to-br from-indigo-900/80 to-indigo-800/60 relative">
              <div className="absolute bottom-1.5 left-1.5 text-[9px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded">Customer</div>
            </div>
            <div className="h-16 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-2">
              <div className="flex items-center gap-1 text-[9px] text-muted mb-1">
                <MessageSquare className="w-2.5 h-2.5" /> Chat
              </div>
              <div className="space-y-1">
                <div className="h-1.5 w-3/4 rounded-full bg-indigo-200 dark:bg-indigo-900/60" />
                <div className="h-1.5 w-1/2 rounded-full bg-slate-200 dark:bg-slate-700 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          {[Mic, MonitorUp, Users].map((Icon, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] flex items-center justify-center text-muted"
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
          ))}
          <div className="w-10 h-8 rounded-full bg-red-500/90 flex items-center justify-center text-white text-[10px] font-bold ml-1">
            End
          </div>
        </div>
      </div>

      {/* Floating stat chips */}
      <div className="absolute -left-6 top-1/4 card px-3 py-2 text-xs font-medium shadow-lg animate-float hidden sm:block" style={{ animationDelay: '0.5s' }}>
        <span className="text-emerald-500">●</span> SFU routed
      </div>
      <div className="absolute -right-4 bottom-1/4 card px-3 py-2 text-xs font-medium shadow-lg animate-float hidden sm:block" style={{ animationDelay: '1.2s' }}>
        End-to-end encrypted
      </div>
    </div>
  );
}
