# Architecture — SupportVision

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Clients                           │
│  ┌──────────────┐                    ┌──────────────┐           │
│  │ Agent Portal │                    │ Customer Join│           │
│  │  (Next.js)   │                    │  (Next.js)   │           │
│  └──────┬───────┘                    └──────┬───────┘           │
└─────────┼───────────────────────────────────┼───────────────────┘
          │ HTTP/REST                         │
          │ WebSocket (Socket.io)             │
          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js Backend (Express)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ REST API    │  │ Socket.io    │  │ JWT Auth Middleware │    │
│  │ Sessions    │  │ Signaling    │  │ Role Enforcement    │    │
│  │ Chat/Files  │  │ Chat Events  │  │                     │    │
│  └──────┬──────┘  └──────┬───────┘  └─────────────────────┘    │
│         │                │                                       │
│         │         ┌──────▼───────┐                               │
│         │         │ mediasoup SFU │  ◄── Server-routed media    │
│         │         │ (WebRTC)      │                               │
│         │         └──────┬───────┘                               │
└─────────┼────────────────┼───────────────────────────────────────┘
          │                │
          ▼                ▼ RTP/SRTP streams
┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │  File Storage   │
│   (Neon)        │  │  uploads/       │
│                 │  │  recordings/    │
│ • Sessions      │  └─────────────────┘
│ • Participants  │
│ • Messages      │
│ • Events        │
│ • Recordings    │
└─────────────────┘
```

## Design Decisions

### Why mediasoup (SFU)?

The problem statement requires **media to route through a server** — direct P2P WebRTC is not acceptable. mediasoup is:

- Open-source and free
- Production-grade SFU used by many companies
- Supports mute/unmute, simulcast, recording via PlainTransport + FFmpeg

Each session gets a mediasoup **Router**. Participants create **WebRtcTransports**, **produce** their local tracks, and **consume** remote tracks — all forwarded through the SFU.

### Why Next.js + Express (not monolith)?

- **Separation of concerns**: API/signaling/media server vs UI
- **Independent scaling**: SFU workers can scale separately from web tier
- **Modern UX**: Next.js App Router for fast, beautiful client experience

### Authentication & Roles

| Role | JWT Claims | Permissions |
|------|-----------|-------------|
| AGENT | `role: AGENT`, `sessionId` | Create/end sessions, recording |
| CUSTOMER | `role: CUSTOMER`, `sessionId` | Join via invite, chat, media |
| ADMIN | `role: ADMIN` | Dashboard, force-end sessions |

Customers receive JWT only after validating invite token — they cannot create sessions.

### Session Lifecycle

```
Agent creates session
       │
       ▼
  ACTIVE ──────────────────► Customer joins via invite
       │                              │
       │                              ▼
       │                    Both in mediasoup room
       │                              │
       ▼                              ▼
  Agent ends / Admin force-end / All leave
       │
       ▼
    ENDED → History queryable (participants, messages, events)
```

### Reconnect Handling

On unexpected disconnect:
1. Server starts 30-second grace timer
2. Other participants are **not** notified (seamless UX)
3. If reconnect within window → cancel timer, resume
4. After grace period → mark participant as left, notify others

### Recording Pipeline

```
Agent starts recording
       │
       ▼
  IN_PROGRESS (DB + socket broadcast)
       │
  Agent stops recording
       │
       ▼
  PROCESSING (async job)
       │
       ▼
  READY → Download via GET /api/recordings/:id/download
```

> Production recording: use mediasoup PlainTransport to pipe RTP into FFmpeg for real muxed output.

### Observability

Prometheus metrics exposed at `/metrics`:

- `active_sessions_total` — Live mediasoup rooms
- `connected_participants_total` — Peers in SFU
- `errors_total` — Application error counter

Compatible with Grafana (free, self-hosted).

## Database Schema

```
Session ──┬── Participant (join/leave timestamps, duration)
          ├── Message (chat + file references)
          ├── Event (audit log)
          ├── Recording (status lifecycle)
          └── SessionFile (uploaded attachments)
```

## Security Considerations

- JWT on all protected routes and socket connections
- Role middleware blocks customer from agent actions (403)
- Invite token required for customer join
- File upload type whitelist (images, PDF, DOCX)
- Rate limiting on API (100 req/min)
- Agent secret required for session creation

## Scaling Path

1. **Horizontal**: Multiple mediasoup workers behind load balancer
2. **Redis**: Replace in-memory reconnect state for multi-instance
3. **S3/MinIO**: Move file storage off local disk
4. **FFmpeg workers**: Dedicated recording processing queue

## Cost: 100% Free Tier

| Service | Free Option |
|---------|-------------|
| Database | Neon PostgreSQL free tier |
| Hosting | Railway/Render free tier, or local |
| Media | Self-hosted mediasoup (no per-minute fees) |
| Monitoring | Prometheus + Grafana (self-hosted) |
