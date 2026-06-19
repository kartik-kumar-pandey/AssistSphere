'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Link2, Share2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildEmailShareUrl,
  buildFacebookShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  copyInviteLink,
  DEFAULT_INVITE_MESSAGE,
  nativeShareInvite,
} from '@/lib/inviteShare';

interface InviteShareMenuProps {
  inviteLink: string;
  message?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  variant?: 'button' | 'icon' | 'none';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type ShareOption = {
  id: string;
  label: string;
  icon: ReactNode;
  action: () => void | Promise<void>;
};

function BrandIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0',
        className
      )}
    >
      {children}
    </span>
  );
}

export function InviteShareMenu({
  inviteLink,
  message = DEFAULT_INVITE_MESSAGE,
  triggerLabel = 'Invite',
  triggerClassName,
  variant = 'button',
  open: controlledOpen,
  onOpenChange,
}: InviteShareMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 2500);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await copyInviteLink(inviteLink);
      setCopied(true);
      showToast('Invite link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy link');
    }
  }, [inviteLink, message, showToast]);

  const openShareWindow = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=640');
    setOpen(false);
  }, []);

  const copyForPasteApps = useCallback(async (appName: string) => {
    try {
      await copyInviteLink(inviteLink);
      showToast(`Copied — paste in ${appName}`);
      setOpen(false);
    } catch {
      showToast('Could not copy link');
    }
  }, [inviteLink, message, showToast]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const options: ShareOption[] = [
    {
      id: 'copy',
      label: copied ? 'Copied!' : 'Copy link',
      icon: copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />,
      action: handleCopy,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <>WA</>,
      action: () => openShareWindow(buildWhatsAppShareUrl(inviteLink, message)),
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: <>TG</>,
      action: () => openShareWindow(buildTelegramShareUrl(inviteLink, message)),
    },
    {
      id: 'discord',
      label: 'Discord',
      icon: <>DC</>,
      action: () => copyForPasteApps('Discord'),
    },
    {
      id: 'instagram',
      label: 'Instagram',
      icon: <>IG</>,
      action: () => copyForPasteApps('Instagram'),
    },
    {
      id: 'email',
      label: 'Email',
      icon: <>@</>,
      action: () => {
        window.location.href = buildEmailShareUrl(inviteLink, message);
        setOpen(false);
      },
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: <>f</>,
      action: () => openShareWindow(buildFacebookShareUrl(inviteLink)),
    },
  ];

  async function handleNativeShare() {
    try {
      const shared = await nativeShareInvite(inviteLink, message);
      if (shared) setOpen(false);
      else showToast('Sharing not supported on this device');
    } catch {
      // user cancelled
    }
  }

  return (
    <>
      {variant === 'none' ? null : variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'p-2 rounded-lg hover:bg-[var(--color-surface-muted)] text-indigo-600 dark:text-indigo-400 transition-colors',
            triggerClassName
          )}
          title="Share invite link"
        >
          <Link2 className="w-5 h-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 w-full',
            'px-5 py-2.5 text-sm rounded-xl',
            'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]',
            'hover:bg-[var(--color-surface-muted)] shadow-sm',
            triggerClassName
          )}
        >
          <Share2 className="w-4 h-4" />
          {triggerLabel}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            ref={panelRef}
            className="w-full max-w-md card-elevated rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-labelledby="invite-share-title"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
              <div>
                <h2 id="invite-share-title" className="text-lg font-bold text-[var(--color-text)]">
                  Share meeting link
                </h2>
                <p className="text-sm text-muted mt-0.5">
                  Invite someone to join this session
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--color-surface-muted)] text-muted"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Meeting link</p>
              <div className="bg-[var(--color-surface-muted)] rounded-xl p-3 border border-[var(--color-border)]">
                <p className="text-sm text-indigo-600 dark:text-indigo-400 break-all font-mono">{inviteLink}</p>
              </div>
            </div>

            <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void option.action()}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] transition-colors text-left"
                >
                  <BrandIcon
                    className={cn(
                      option.id === 'copy' && 'bg-slate-700',
                      option.id === 'whatsapp' && 'bg-[#25D366]',
                      option.id === 'telegram' && 'bg-[#229ED9]',
                      option.id === 'discord' && 'bg-[#5865F2]',
                      option.id === 'instagram' && 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]',
                      option.id === 'email' && 'bg-indigo-600',
                      option.id === 'facebook' && 'bg-[#1877F2]'
                    )}
                  >
                    {option.icon}
                  </BrandIcon>
                  <span className="text-sm font-semibold text-[var(--color-text)]">{option.label}</span>
                </button>
              ))}
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <div className="px-5 pb-5 pt-0">
                <button
                  type="button"
                  onClick={() => void handleNativeShare()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-primary text-white font-semibold text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  More apps…
                </button>
              </div>
            )}

            {toast && (
              <div className="px-5 pb-4">
                <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">{toast}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
