# Rate Limiter as a Service

A production-ready rate limiting middleware built with Node.js, Express, and Redis. Supports three rate limiting algorithms with IP whitelisting/blacklisting and per-route configuration.

---

## Problem Statement

Without rate limiting, a single client can flood your API with thousands of requests per second — crashing your server for all other users. This project implements a configurable rate limiting layer that sits in front of your Express routes and enforces request limits per IP.

---

## Features

- Three rate limiting algorithms (Fixed Window, Token Bucket, Sliding Window Log)
- Per-route rate limit configuration with different algorithms per endpoint
- IP Whitelist — bypass rate limiting for trusted IPs
- IP Blacklist — permanently block malicious IPs
- RFC-compliant rate limit response headers
- Real-time stats endpoint for observability
- Admin endpoints to manage whitelist/blacklist at runtime
- Fail-open strategy — if Redis goes down, traffic is not blocked
- Redis pipeline for atomic multi-command operations

---

## Architecture

```
Client Request
      │
      ▼
┌─────────────────┐
│  Blacklist Check │  → 403 Forbidden (if blacklisted)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Whitelist Check │  → pass through (if whitelisted)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Rate Limiter   │  → 429 Too Many Requests (if over limit)
│  (algorithm)    │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  Route Handler  │  → 200 OK
└─────────────────┘
```

---

## Algorithms

### 1. Fixed Window Counter
Divides time into fixed buckets (e.g., every 60 seconds). Counts requests per IP per bucket using Redis `INCR`. Simple and fast but vulnerable to boundary burst attacks.

**Redis commands:** `INCR`, `EXPIRE`
**Time complexity:** O(1)

### 2. Token Bucket
Each IP has a bucket of tokens that refills continuously at a fixed rate. Each request consumes one token. Allows controlled bursts while enforcing a long-term average rate. Used by Stripe in production.

**Redis commands:** `GET`, `SETEX`
**Time complexity:** O(1)

### 3. Sliding Window Log
Stores the exact timestamp of every request in a Redis Sorted Set. On each request, removes timestamps outside the window and counts remaining. Most accurate algorithm — no boundary burst problem.

**Redis commands:** `ZADD`, `ZREMRANGEBYSCORE`, `ZCOUNT`, `EXPIRE` (via pipeline)
**Time complexity:** O(log n)

---

## Tech Stack

| Technology | Why |
|---|---|
| Node.js | Non-blocking I/O handles high concurrency |
| Express | Minimal framework perfect for middleware architecture |
| Redis | Atomic operations prevent race conditions across multiple servers |
| dotenv | Environment-based config for easy deployment |

---

## Setup

### Prerequisites
- Node.js 18+
- Redis server running on localhost:6379

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/rate-limiter-node.git
cd rate-limiter-node
npm install
```

### Environment Variables

Create `.env` in root:

```
PORT=3000
REDIS_URL=redis://localhost:6379
WINDOW_SIZE_SECONDS=60
MAX_REQUESTS=10
BUCKET_CAPACITY=10
REFILL_RATE=1
SLIDING_WINDOW_SECONDS=60
SLIDING_MAX_REQUESTS=10
```

### Run

```bash
npm run dev
```

---

## API Reference

### Core Endpoints

| Method | Route | Rate Limit | Description |
|---|---|---|---|
| GET | `/` | 10 req/60s (sliding) | Base route |
| POST | `/api/login` | 5 req/60s (sliding) | Login simulation |
| GET | `/api/search` | 30 req/60s (token) | Search simulation |
| GET | `/health` | none | Health check |

### Stats & Admin Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/stats/:ip` | Real-time rate limit stats for an IP |
| GET | `/admin/lists` | View current whitelist and blacklist |
| POST | `/admin/whitelist` | Add IP to whitelist |
| POST | `/admin/blacklist` | Add IP to blacklist |
| DELETE | `/admin/whitelist` | Remove IP from whitelist |
| DELETE | `/admin/blacklist` | Remove IP from blacklist |

### Response Headers

Every rate-limited response includes:

```
RateLimit-Limit: 10
RateLimit-Remaining: 7
RateLimit-Reset: 1712000060
Retry-After: 60 (on 429 only)
X-RateLimit-Algorithm: sliding
X-RateLimit-Count: 3
```

### Example Responses

**200 OK**
```json
{ "message": "Request successful ✓" }
```

**429 Too Many Requests**
```json
{
  "error": "Too Many Requests",
  "algorithm": "sliding",
  "limit": 10,
  "remaining": 0,
  "retryAfter": 60
}
```

**403 Forbidden**
```json
{
  "error": "Forbidden",
  "message": "Your IP has been blacklisted"
}
```

---

## Key Design Decisions

**Why Redis over in-memory storage?**
In-memory counters break with multiple server instances — each server has its own count. Redis is a shared external store, so all servers see the same counts. Redis `INCR` is atomic, preventing race conditions.

**Why fail-open on Redis errors?**
If the rate limiter crashes, it's better to let traffic through than to block your entire API. Availability > perfect rate limiting.

**Why Sliding Window over Fixed Window?**
Fixed Window allows 2x the limit at window boundaries (boundary burst attack). Sliding Window tracks exact timestamps so the limit is enforced accurately at all times.

**Why Redis Pipeline for Sliding Window?**
Sliding Window requires 4 Redis commands per request. Without pipeline that's 4 network round trips. Pipeline batches them into 1, reducing latency by ~75%.

---

## What I Learned

- Redis data structures: Strings, Sorted Sets, Sets and when to use each
- Atomic operations and why they matter for distributed systems
- Middleware factory pattern in Express
- Rate limiting tradeoffs: accuracy vs memory vs burst tolerance
- Observability — exposing internal state via stats endpoints
- Fail-open vs fail-closed strategies

---

## Next Steps

- Add Lua scripts for true atomicity in Token Bucket
- Add rate limit rules per API key, not just IP
- Build a React dashboard to visualize rate limit stats in real time
- Add distributed rate limiting across multiple Redis nodes
