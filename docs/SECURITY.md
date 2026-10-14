# ApniLeap Security & Threat Mitigation Specification

## 1. Authentication Architecture

ApniLeap implements a defense-in-depth security model eliminating all hardcoded credential fallbacks and forged client-side tokens.

```
 Client                          BFF Service                       Team C (DBMS)
   │                                  │                                  │
   │ 1. POST /api/v1/ui/session       │                                  │
   │    { email, password }           │                                  │
   ├─────────────────────────────────►│ 2. Authenticate User             │
   │                                  ├─────────────────────────────────►│
   │                                  │    POST /internal/v1/users/auth  │
   │                                  │◄─────────────────────────────────┤
   │                                  │    { user_id, role, name }       │
   │                                  │                                  │
   │ 3. 200 OK                        │ (Scrypt Hash Verification)       │
   │    Access Token (15m in JSON)    │ (Role derived ONLY from DB)      │
   │    Refresh Token (7d in Cookie)  │                                  │
   │◄─────────────────────────────────┤                                  │
```

### 1.1 Password Hashing with Scrypt
All user passwords are encrypted using Node.js native `crypto.scrypt`:
- Salt: 16 bytes cryptographically random entropy (`randomBytes(16)`)
- Key Length: 64 bytes
- Cost Parameters: $N=16384$, $r=8$, $p=1$
- Format: `salt:derivedKeyHex`
- Protection: Resistant to GPU/ASIC rainbow table attacks.

### 1.2 Multi-Tier Token Lifecycles
- **Access Tokens:** Short-lived JWTs (15 minutes expiry) signed using HMAC-SHA256 (`config.JWT_SECRET`). Carries verified `user_id`, `name`, `email`, and `role`.
- **Refresh Tokens:** Long-lived JWTs (7 days expiry) stored in an `httpOnly`, `SameSite=Strict`, `Secure` (in production) HTTP cookie. Inaccessible to client JavaScript, preventing XSS-based token theft.
- **Inter-Service Tokens (`X-Service-Token`):** Internal microservice endpoints (`/internal/v1/*`) mandate cryptographic service tokens generated via `signServiceToken` using `INTERNAL_SERVICE_SECRET`. Requests lacking valid service tokens fail immediately with 401 Unauthorized.

---

## 2. Role-Based Access Control (RBAC) Matrix

Roles are derived strictly from the verified database record at authentication time. Client-submitted roles are ignored.

| Resource / Action | Endpoint | Student | Faculty_TPO | Placement_Admin |
|---|---|---|---|---|
| View Open Drives | `GET /api/v1/ui/drives` | ✅ | ✅ | ✅ |
| Submit Application | `POST /api/v1/ui/applications` | ✅ (Self only) | ❌ | ❌ |
| View My Applications | `GET /api/v1/ui/applications` | ✅ (Self only) | ✅ (All) | ✅ (All) |
| Withdraw Application | `POST /api/v1/applications/:id/withdraw` | ✅ (Self only) | ❌ | ✅ |
| View Candidate Rankings | `GET /api/v1/ui/rankings` | ❌ | ✅ | ✅ |
| Run Custom Shortlist | `POST /api/v1/ui/rankings/preview` | ❌ | ✅ | ✅ |
| Department Analytics | `GET /api/v1/ui/reports/placement-performance`| ❌ | ✅ | ✅ |
| Post New Drive | `POST /api/v1/drives` | ❌ | ❌ | ✅ |
| Modify Drive Criteria | `PATCH /api/v1/ui/drives/:id` | ❌ (403) | ❌ (403) | ✅ (200) |
| Trigger WAL Verification | `POST /internal/v1/recovery/verify` | ❌ (403) | ❌ (403) | ✅ (200) |
| Inspect Institutional Audit | `GET /api/v1/audit` | ❌ (403) | ❌ (403) | ✅ (200) |

---

## 3. Data Isolation & Ownership Validation

To prevent Insecure Direct Object References (IDOR):
- **Student ID Enforcement:** When a student invokes `POST /api/v1/ui/applications`, the BFF automatically overwrites or validates `student_id` against the verified JWT payload `req.user.user_id`. Any attempt to submit an application on behalf of another candidate is logged as an ownership violation and rejected with `403 FORBIDDEN`.
- **Application Query Filtering:** When a student queries `GET /api/v1/ui/applications`, the BFF enforces a filter allowing the student to view only records matching their verified identifier.

---

## 4. Threat Mitigations & Hardening Controls

- **Brute Force Lockout:** The authentication endpoint `/api/v1/ui/session` tracks failed login attempts. After 5 consecutive failures, the account is temporarily locked for 5 minutes (`locked_until`).
- **HTTP Rate Limiting:** Powered by `express-rate-limit`. Public API routes are limited to 300 requests per 15-minute window; login endpoints are restricted to 20 attempts per window.
- **Security Headers:** Express applications use `helmet` with strict MIME-sniffing protection, frameguard (`X-Frame-Options: SAMEORIGIN`), and HSTS in production.
- **Fail-Closed Principle:** Any route protected by `requireRole` or `requireAuth` defaults to denial (`401` or `403`) if token decoding fails, claims are malformed, or authorization headers are missing.
- **Immutable Audit Logging:** Critical business actions (seat decrement, offer issuance, state changes) write immutable audit records to the `audit_log` table in Team C.
