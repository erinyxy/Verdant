# Verdant Server Handoff

Hi. You're deploying a small private backend for **Verdant**, a plant
memory journal app. The public demo (https://verdant-neon.vercel.app)
stays browser-local for anonymous visitors — your backend only serves the
single owner, over Tailscale, no public internet exposure.

Read these four files in order. They are self-contained; you do not need
to read the frontend source code.

## 1. `requirements.md` — start here
The deployment task: scope, server layout, runtime (Node 20 + systemd),
Tailscale Serve, auth model, CORS, security, backup, and the final
deliverables checklist. This is the contract.

## 2. `data-model.ts` — the data shapes
The exact TypeScript types the frontend produces and consumes. The
backend's SQLite tables and JSON responses must mirror these. Three rules
to internalize:

- **IDs are client-generated.** Store them verbatim, never reassign.
- **Timestamps are ISO 8601 strings.** Not unix millis.
- **Conflict policy: last-write-wins by `updatedAt`.** No merge logic.

## 3. `api-contract.md` — endpoints and examples
Every endpoint the frontend will call: method, path, auth, request shape,
response shape. Includes a sample request, the auth/CORS rules in detail,
and a non-binding SQLite schema sketch.

## 4. `sample-backup.json` — a real payload
A real export from the owner's current browser data, in the exact format
`POST /import` must accept. Use it as fixture data while developing, and
to verify the migration endpoint works end-to-end.

---

## Quick orientation

- **Where to work**: `/data/r00t/verdant/` only. Don't touch system
  config outside it without checking with the server owner.
- **Owner's identity**: a single `OWNER_TOKEN` shared secret, in `.env`.
  No user accounts, no sign-up, no multi-tenancy.
- **Network**: API binds `127.0.0.1:3001`. Tailscale Serve fronts it
  with HTTPS over the tailnet. The port is never reachable from the
  public internet or LAN.
- **Frontend repo (public, for reference only)**: see the GitHub link
  the owner provides. The only files relevant to you are
  `lib/dataStore.ts` and `lib/seedData.ts` — and even those are already
  distilled into `data-model.ts` here.

## When in doubt

Ask the owner before:

- Installing global packages or modifying system services beyond
  `verdant-api.service`.
- Changing firewall, nginx, sshd, or SELinux/AppArmor config.
- Choosing between the two photo-serving options (§9 of requirements.md).
- Wiping any existing data during `/import`.

Otherwise: follow the requirements doc, report back the deliverables
checklist at the end.
