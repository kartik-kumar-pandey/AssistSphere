'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Link2, Share2, X, Mail } from 'lucide-react';
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
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.001 4.908A9.817 9.817 0 0012.037 2c-5.433 0-9.85 4.417-9.85 9.85 0 1.737.454 3.43 1.316 4.925L2 22l5.37-1.408A9.8 9.8 0 0012.033 21.7c5.433 0 9.85-4.417 9.85-9.85a9.812 9.812 0 00-2.882-6.942zm-6.964 15.11a8.17 8.17 0 01-4.167-1.144l-.3-.178-3.1.813.827-3.02-.195-.31a8.163 8.163 0 01-1.25-4.329c0-4.512 3.67-8.181 8.185-8.181 2.185 0 4.24.85 5.783 2.395a8.125 8.125 0 012.4 5.786c-.004 4.513-3.674 8.182-8.183 8.182zm4.535-6.19c-.248-.124-1.47-.724-1.696-.807-.228-.083-.393-.124-.559.124-.166.248-.641.807-.786.973-.145.165-.29.186-.538.062a7.35 7.35 0 01-1.998-1.23 8.1 8.1 0 01-1.383-1.722c-.145-.248-.015-.383.11-.507.112-.111.248-.29.372-.434.124-.145.165-.248.248-.414.083-.166.04-.31-.02-.434-.063-.124-.559-1.346-.766-1.844-.202-.486-.406-.42-.56-.428-.145-.008-.31-.008-.476-.008-.166 0-.435.062-.663.31-.228.248-.869.849-.869 2.07 0 1.22.89 2.4 1.014 2.565.124.166 1.751 2.673 4.24 3.743.593.255 1.056.407 1.417.521.597.19 1.139.163 1.57.099.479-.07 1.47-.6 1.677-1.18.207-.579.207-1.076.145-1.18-.062-.104-.228-.166-.476-.29z"/>
        </svg>
      ),
      action: () => openShareWindow(buildWhatsAppShareUrl(inviteLink, message)),
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M23.977 2.485a.5.5 0 00-.5-.485L1.042 9.043a.5.5 0 00-.022.929l5.733 1.8 1.83 5.734a.5.5 0 00.913.04l2.846-3.805 4.887 3.738a.5.5 0 00.803-.314l5.98-19.467-.035-.213zM9.476 14.51L19.246 4.74c.1-.1.25.05.15.15l-9.15 9.15-.05.05v2.85z"/>
        </svg>
      ),
      action: () => openShareWindow(buildTelegramShareUrl(inviteLink, message)),
    },
    {
      id: 'discord',
      label: 'Discord',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.955 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
        </svg>
      ),
      action: () => copyForPasteApps('Discord'),
    },
    {
      id: 'instagram',
      label: 'Instagram',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
        </svg>
      ),
      action: () => copyForPasteApps('Instagram'),
    },
    {
      id: 'email',
      label: 'Email',
      icon: <Mail className="w-5 h-5 text-white" />,
      action: () => {
        window.location.href = buildEmailShareUrl(inviteLink, message);
        setOpen(false);
      },
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
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
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] transition-colors text-left overflow-hidden"
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
                  <span className="text-xs sm:text-sm font-semibold text-[var(--color-text)] truncate">{option.label}</span>
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
