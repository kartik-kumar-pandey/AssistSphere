export const DEFAULT_INVITE_MESSAGE =
  'Join my AssistSphere support session:';

export function buildInviteShareText(inviteLink: string, message = DEFAULT_INVITE_MESSAGE) {
  return `${message}\n${inviteLink}`;
}

export function buildWhatsAppShareUrl(inviteLink: string, message = DEFAULT_INVITE_MESSAGE) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(buildInviteShareText(inviteLink, message))}`;
}

export function buildTelegramShareUrl(inviteLink: string, message = DEFAULT_INVITE_MESSAGE) {
  return `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(message)}`;
}

export function buildEmailShareUrl(inviteLink: string, message = DEFAULT_INVITE_MESSAGE) {
  const subject = 'AssistSphere session invite';
  const body = buildInviteShareText(inviteLink, message);
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildTwitterShareUrl(inviteLink: string, message = DEFAULT_INVITE_MESSAGE) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildInviteShareText(inviteLink, message))}`;
}

export function buildFacebookShareUrl(inviteLink: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`;
}

export function buildLinkedInShareUrl(inviteLink: string, message = DEFAULT_INVITE_MESSAGE) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteLink)}&summary=${encodeURIComponent(message)}`;
}

export async function copyInviteLink(inviteLink: string) {
  await navigator.clipboard.writeText(inviteLink);
  return inviteLink;
}

export async function nativeShareInvite(inviteLink: string, message = DEFAULT_INVITE_MESSAGE) {
  if (!navigator.share) return false;
  await navigator.share({
    title: 'AssistSphere invite',
    text: message,
    url: inviteLink,
  });
  return true;
}
