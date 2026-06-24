'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CallRoom } from '@/components/CallRoom';
import { loadAuth, saveAuth, apiFetch } from '@/lib/utils';

interface AuthData {
  token: string;
  name: string;
  sessionId: string;
  participantId: string;
  role: 'AGENT' | 'CUSTOMER';
  inviteLink?: string;
}

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const agentAuth = loadAuth<AuthData>('agentAuth');
      const customerAuth = loadAuth<AuthData>('customerAuth');
      const userAuth = loadAuth<{ token: string; name: string; role: string }>('userAuth');
      const persistentAgent = loadAuth<{ token: string; name: string }>('persistentAgent');

      let data = agentAuth?.sessionId === sessionId
        ? agentAuth
        : customerAuth?.sessionId === sessionId
          ? customerAuth
          : null;

      const activeToken = userAuth?.token || persistentAgent?.token;
      const activeName = userAuth?.name || persistentAgent?.name || 'Agent';

      if (!data && activeToken) {
        try {
          const res = await apiFetch<{
            sessionId: string;
            token: string;
            participantId: string;
            inviteLink: string;
            inviteToken: string;
          }>(`/sessions/${sessionId}/join`, { method: 'POST' }, activeToken);

          if (res && res.token) {
            const newAuth: AuthData = {
              token: res.token,
              name: activeName,
              sessionId: res.sessionId,
              participantId: res.participantId,
              role: 'AGENT',
              inviteLink: res.inviteLink,
            };
            saveAuth('agentAuth', {
              ...newAuth,
              inviteToken: res.inviteToken,
            });
            data = newAuth;
          }
        } catch (err) {
          console.error('Failed to auto-join session as agent:', err);
        }
      }

      if (!data) {
        router.replace('/');
        return;
      }
      setAuth(data);
      setLoading(false);
    }

    void initAuth();
  }, [sessionId, router]);

  function handleLeave() {
    router.push(`/summary/${sessionId}`);
  }

  if (loading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <CallRoom
      sessionId={sessionId}
      token={auth.token}
      name={auth.name}
      role={auth.role}
      inviteLink={auth.inviteLink}
      onLeave={handleLeave}
    />
  );
}
