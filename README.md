# Rate Limiter as a Service

A production-ready distributed Rate Limiter built with Node.js, Express, and Redis. Supports three algorithms, real-time dashboard, dynamic config, and IP-based security controls.

![dashboard](assets/dashboard.png)

---

## Features

- **3 Rate Limiting Algorithms** — Fixed Window, Token Bucket (Lua atomic), Sliding Window Log
- **Real-time Dashboard** — React + Socket.io live request monitoring
- **Dynamic Config** — Change limits at runtime via Redis, no restart needed
- **IP Security** — Whitelist/Blacklist with O(1) Redis Set lookups
- **Per-route Limits** — Different algorithms and limits per endpoint
- **RFC Headers** — Industry standard `RateLimit-*` response headers
- **Admin API** — Protected endpoints with API key auth
- **Input Validation** — Zod schema validation on all inputs
- **Structured Logging** — Winston with file rotation
- **Unit Tested** — 17 Jest tests covering all algorithms
- **Fail-open** — Redis failure doesn't block traffic

---

## Architecture

```
Client Request
      │
      ▼
┌─────────────────┐
│ Blacklist Check │──→ 403 Forbidden
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Whitelist Check │──→ next() (bypass)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Dynamic Config │──→ Redis rule or env default
│  (cache-aside)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rate Limiter   │──→ 429 Too Many Requests
│  Algorithm      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route Handler  │──→ 200 OK
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Socket.io emit │──→ Dashboard update
└─────────────────┘
```

---

## Algorithms

### Fixed Window Counter
Divides time into fixed buckets. Counts requests per IP per bucket using Redis `INCR`. Simple and fast but vulnerable to boundary burst at window edges.

**Redis:** `INCR`, `EXPIRE` | **Complexity:** O(1)

### Token Bucket (Lua Atomic)
Tokens refill continuously at a fixed rate. Each request consumes one token. Implemented as a **Lua script** running entirely inside Redis — eliminates the TOCTOU race condition of the naive GET→compute→SET approach. Used by Stripe in production.

**Redis:** `EVALSHA` (Lua) | **Complexity:** O(1)

### Sliding Window Log
Stores exact request timestamps in a Redis Sorted Set. Removes entries outside the window on each request using a **pipeline** (4 commands in 1 round trip). Most accurate — no boundary burst problem.

**Redis:** `ZADD`, `ZREMRANGEBYSCORE`, `ZCOUNT`, `EXPIRE` (pipeline) | **Complexity:** O(log n)

---

## Tech Stack

| Technology | Why |
|---|---|
| Node.js + Express | Non-blocking I/O, middleware architecture |
| Redis | Atomic ops, shared state across servers |
| Socket.io | Real-time WebSocket push to dashboard |
| React + Vite | Fast dashboard development |
| Winston | Structured logging with file persistence |
| Zod | Runtime schema validation |
| Helmet | Security headers in one line |
| Jest | Unit testing with Redis mocking |

---

## Project Structure

```
rate-limiter-node/
├── src/
│   ├── limiters/
│   │   ├── fixedWindow.js
│   │   ├── tokenBucket.js      ← Lua atomic
│   │   └── slidingWindow.js    ← Redis pipeline
│   ├── middleware/
│   │   ├── rateLimiter.js      ← factory pattern
│   │   └── adminAuth.js
│   ├── routes/
│   │   ├── admin.js
│   │   └── stats.js
│   ├── scripts/
│   │   └── tokenBucket.lua     ← atomic Lua script
│   ├── config/
│   │   └── ruleCache.js        ← cache-aside pattern
│   ├── utils/
│   │   ├── ipFilter.js
│   │   ├── logger.js
│   │   └── validators.js
│   └── app.js
├── dashboard/                  ← React + Vite
│   └── src/
│       ├── components/
│       │   ├── StatCard.jsx
│       │   ├── RequestLog.jsx
│       │   ├── IPManager.jsx
│       │   └── ConfigEditor.jsx
│       └── App.jsx
├── tests/
│   ├── fixedWindow.test.js
│   ├── tokenBucket.test.js
│   └── slidingWindow.test.js
├── logs/                       ← gitignored
├── assets/                     ← screenshots
├── redisClient.js
├── .env.example
├── rate-limiter.postman_collection.json
└── README.md
```

---

## Setup

### Prerequisites
- Node.js 18+
- Redis server running on port 6379

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/rate-limiter-node.git
cd rate-limiter-node
npm install
cp .env.example .env
# Edit .env with your values
```

### Run Backend

```bash
npm run dev
```

### Run Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173`

---

## API Reference

### Core Endpoints

| Method | Route | Limit | Algorithm |
|---|---|---|---|
| GET | `/` | 10/60s | Sliding |
| POST | `/api/login` | 5/60s | Sliding |
| GET | `/api/search` | 30/60s | Token |
| GET | `/health` | none | — |

### Admin Endpoints (requires `X-Admin-Key` header)

| Method | Route | Description |
|---|---|---|
| GET | `/admin/lists` | View whitelist + blacklist |
| POST | `/admin/blacklist` | Add IP to blacklist |
| DELETE | `/admin/blacklist` | Remove IP from blacklist |
| POST | `/admin/whitelist` | Add IP to whitelist |
| DELETE | `/admin/whitelist` | Remove IP from whitelist |
| GET | `/admin/config` | View all dynamic rules |
| POST | `/admin/config` | Set rate limit rule for route |
| DELETE | `/admin/config` | Delete rule (revert to default) |

### Stats Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/stats/` | Summary of all active IPs |
| GET | `/stats/:ip` | Detailed stats for specific IP |

### Response Headers

```
RateLimit-Limit: 10
RateLimit-Remaining: 7
RateLimit-Reset: 1712000060
Retry-After: 60
X-RateLimit-Algorithm: sliding
X-RateLimit-Count: 3
X-Config-Source: redis | static
```

---

## Testing

### Unit Tests

```bash
npm test
```

![tests](assets/tests.png)

17 tests across 3 test suites covering:
- Allow/block boundary conditions
- Expire set only on first request
- Key isolation per IP
- Token refill math
- Bucket capacity cap
- Pipeline command verification
- Custom parameter passing

### API Testing

Import `rate-limiter.postman_collection.json` into Postman.

---

## Key Design Decisions

**Why Redis over in-memory?**
Multiple server instances each have their own memory — shared Redis ensures consistent counts across the entire fleet.

**Why Lua scripts for Token Bucket?**
Naive GET→compute→SET has a TOCTOU race condition. Two simultaneous requests both read stale token count and both get allowed. Lua runs atomically inside Redis — impossible to interrupt.

**Why Redis Pipeline for Sliding Window?**
4 Redis commands per request = 4 network round trips without pipeline. Pipeline batches them into 1 round trip — ~75% latency reduction at scale.

**Why cache-aside for dynamic config?**
Reading config from Redis on every request adds latency. Memory cache serves config in microseconds. 60-second TTL means config changes propagate within 1 minute — no restart needed.

**Why fail-open on Redis errors?**
Availability > perfect rate limiting. A Redis hiccup shouldn't take down your entire API.

---

## What I Learned

- Redis data structures: Strings, Sorted Sets, Sets and when to use each
- Lua scripting inside Redis for atomic multi-step operations
- TOCTOU race conditions and how to eliminate them
- Cache-aside pattern for low-latency config reads
- WebSockets with Socket.io for real-time browser updates
- Middleware factory pattern in Express
- Jest unit testing with dependency mocking
- RFC-compliant API design

---

## Roadmap

- [ ] Rate limiting by API key (not just IP)
- [ ] Prometheus metrics endpoint
- [ ] Redis Cluster support for horizontal scaling
- [ ] Request cost-based limiting (not just count)
