# SupportVision — Real-Time Video Support Platform

A full-stack video calling platform for customer support teams. All media routes through a self-hosted **mediasoup SFU** — no third-party video SDKs.

## Features

### Core (Must-Have)
- **Session Management** — Agents create sessions, customers join via shareable invite link
- **Server-Routed Video/Audio** — mediasoup SFU (not peer-to-peer)
- **In-Call Chat** — Real-time messaging persisted to PostgreSQL
- **Role-Based Access** — Agent vs Customer with JWT enforcement

### Bonus
- **Call Recording** — Agent start/stop with status tracking (Processing → Ready)
- **File Sharing** — Upload images, PDFs, documents in chat
- **Reconnect Handling** — 30-second grace window for seamless reconnection
- **Admin Dashboard** — Live sessions, history, force-end, event logs
- **Observability** — Prometheus metrics at `/metrics`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Node.js, Express, Socket.io |
| Media Server | mediasoup (SFU) |
| Database | PostgreSQL (Neon) |
| Auth | JWT |

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
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
```

> **Windows note:** Set `MEDIASOUP_ANNOUNCED_IP` to your local IP if calls fail to connect.

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

1. **Agent** → Go to `/agent` → Enter name + agent secret → Create session
2. **Copy invite link** → Share with customer
3. **Customer** → Opens link → Enters name → Joins video call
4. Both parties see/hear each other, chat, share files
5. **Agent** ends call → Session history saved

### Default Credentials
| Role | Credentials |
|------|-------------|
| Agent Secret | `agent-secret-key` |
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

## License

MIT — Built for AtomQuest Hackathon 1.0
