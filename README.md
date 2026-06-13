# AssistSphere — Real-Time Video Support Platform

A full-stack video calling platform for customer support teams, built for the AtomQuest Hackathon 1.0. All media routes through a self-hosted **mediasoup SFU** — no third-party video SDKs.

## Features

### Core Capabilities (Section 2)
- **Session Management** — Agents create sessions, customers join via shareable invite link
- **Server-Routed Video/Audio** — Custom WebRTC via mediasoup SFU (not peer-to-peer)
- **In-Call Chat** — Real-time messaging persisted to PostgreSQL
- **Role-Based Access** — Agent vs Customer with strict JWT enforcement

### Bonus Requirements Met (Section 3)
- **Call Recording** — Agent start/stop with status tracking (Processing → Ready)
- **File Sharing** — Upload images, PDFs, documents natively inside the chat
- **Reconnect Handling** — 30-second grace window for seamless network drop reconnection
- **Admin Dashboard** — View live sessions, session history, event logs, and force-end active calls
- **Observability** — Prometheus metrics exposed at `/metrics`

### Additional Features Built
- **Dynamic Layout Engine** — Zoom/Meet-style responsive grid layouts that adapt to the number of participants.
- **Screen Sharing & Presentation Stage** — A dedicated 75% presentation stage split away from the 25% camera filmstrip.
- **Interactive Tools** — Users can "Raise Hand" and send emoji sticker reactions in real-time.
- **Post-Call Summary** — Dedicated page for post-session transcript review, participant stats, and recording download.
- **Professional UI/UX** — Clean, responsive interface featuring native CSS-variable driven Light/Dark modes.
- **High Availability Backend** — Configured with PM2 for zero-downtime restarts and robust persistence on Oracle Cloud.
- **User Accounts** — Agents and Customers can optionally register and log in to persist their identities across sessions.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Node.js, Express, Socket.io, PM2 |
| Media Server | mediasoup (SFU) |
| Database | PostgreSQL (Neon) via Prisma ORM |
| Auth | Custom JWT Implementation |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database ([Neon](https://neon.tech) free tier works)

### 1. Clone & Install

```bash
npm install
```

### 2. Configure Backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
JWT_SECRET="your-long-random-secret"
MEDIASOUP_ANNOUNCED_IP="127.0.0.1" # Set to your Cloud Server's Public IP for production
```

> **Note:** Set `MEDIASOUP_ANNOUNCED_IP` to your public IP if deploying to a cloud server, or your local LAN IP if testing across devices on the same network.

### 3. Configure Frontend

```bash
cp frontend/.env.local.example frontend/.env.local
```

### 4. Push Database Schema

```bash
npm run db:push
```

### 5. Run Development

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- Metrics: http://localhost:4000/metrics

## Usage Flow

1. **Agent** → Go to `/agent` → Enter name (or log in) → Create session
2. **Copy invite link** → Share with customer
3. **Customer** → Opens link → Enters name → Joins video call instantly (no downloads)
4. Both parties see/hear each other, chat, share files, and can use screen sharing
5. **Agent** ends call → Both are redirected to the Post-Call Summary where chat history and recordings are accessible

### Default Credentials
| Role | Credentials |
|------|-------------|
| Admin | `admin` / `admin123` |

## API Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/agent` | — | Agent login |
| POST | `/api/sessions` | Agent | Create session |
| POST | `/api/sessions/join/:token` | — | Customer join |
| POST | `/api/sessions/:id/end` | Agent | End session |
| GET | `/api/sessions/:id/messages` | Auth | Chat history |
| GET | `/api/admin/sessions/live` | Admin | Live sessions |
| GET | `/metrics` | — | Prometheus metrics |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design diagram and details.

## Known Limitations
- Recording is a client-side composite (agent browser) rather than a server-side FFmpeg pipeline.
- No TURN server is configured, meaning it depends on the standard SFU NAT traversal capabilities.

## License

MIT — Built for AtomQuest Hackathon 1.0
