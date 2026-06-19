'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CallRoom } from '@/components/CallRoom';
import { loadAuth } from '@/lib/utils';

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

  useEffect(() => {
    const agentAuth = loadAuth<AuthData>('agentAuth');
    const customerAuth = loadAuth<AuthData>('customerAuth');

    const data = agentAuth?.sessionId === sessionId
      ? agentAuth
      : customerAuth?.sessionId === sessionId
        ? customerAuth
        : null;

    if (!data) {
      router.replace('/');
      return;
    }
    setAuth(data);
  }, [sessionId, router]);

  function handleLeave() {
    router.push(`/summary/${sessionId}`);
  }

  if (!auth) {
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
