# n8n-nodes-payload-cms

Community node package for [n8n](https://n8n.io/) providing full integration with the [Payload CMS](https://payloadcms.com/) REST API (v2 & v3).

Built with **zero runtime dependencies**, full **n8n AI Agent Tool** support (`usableAsTool: true`), light & dark themed icons, and strict `@n8n/eslint-plugin-community-nodes` compliance.

## Features

### Nodes Included
- **Payload CMS** (`payloadCms`) — Action node & AI Agent Tool supporting:
  - **Zero-Mod Autodiscovery**: Automatically discovers your Collections, Globals, and nested Field paths directly from Payload's built-in `GET /api/access` endpoint (with a **From List / By Slug** resource locator) — no custom reflection endpoint or backend code required
  - **Collections**: `Get Many` (with pagination, Filter Builder, raw JSON `where`, sorting, `select`), `Get`, `Create`, `Update`, `Update Many` (bulk `PATCH` with `where`), `Delete`, `Delete Many` (bulk `DELETE` with `where`), and `Count`
  - **Globals**: `Get` and `Update`
  - **Media / Uploads**: `Upload` binary files (`multipart/form-data` with optional `_payload` metadata), `Update File`, and `Download` (original file or named Payload image size variant into n8n binary data)
  - **Custom Endpoints**: Call any custom Payload REST endpoint (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) with automatic authentication, query parameters, JSON bodies, custom headers, and Payload options (`depth`, `locale`, `fallback-locale`, `draft`)
  - **Auth**: `Login`, `Get Current User (Me)`, `Refresh Token`, and `Logout`
- **Payload CMS Trigger** (`payloadCmsTrigger`) — Polling trigger node with auto-discovered collection dropdowns supporting:
  - `Document Created`
  - `Document Updated`
  - `Document Created or Updated`
  - Optional Payload `where` filter, `depth`, `locale`, `fallback-locale`, `draft`, and `select` options, plus millisecond-accurate boundary deduplication

### Payload CMS Query & Localization Support
- `depth` (relationship population depth)
- `locale` & `fallback-locale`
- `draft` & `autosave`
- `select` (Payload v3 bracket-notation field selection, including nested dot paths like `meta.description` and exclusions like `-internalNotes`)
- `where` (visual Filter Builder with all Payload operators — `equals`, `not_equals`, `contains`, `like`, `in`, `not_in`, `all`, `exists`, `greater_than`, `less_than`, `near`, `within`, `intersects` — or raw JSON `where` queries)

### Authentication Methods
1. **Payload CMS API (API Key)** — Uses `Authorization: <authCollection> API-Key <apiKey>`.
   Enable API keys on your auth collection in Payload:
   ```ts
   export const Users: CollectionConfig = {
     slug: 'users',
     auth: {
       useAPIKey: true,
     },
     fields: [],
   };
   ```
2. **Payload CMS Email & Password (JWT) API** — Automatically logs in via `POST /api/<authCollection>/login`, caches the JWT in memory until expiry, and retries once with a fresh token on HTTP `401`.

Both credentials support custom `apiRoute` prefixes (default `/api`) and custom `authCollection` slugs (default `users`), and include built-in credential tests.

## Installation

### In n8n (Community Nodes)
Once published to npm, go to **Settings → Community Nodes → Install** and enter:
```
n8n-nodes-payload-cms
```

### Publishing & n8n Verification
This repository includes `.github/workflows/publish.yml` configured with `--provenance` (`id-token: write`) for n8n Creator Portal verification:
1. Configure [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/) (or add an `NPM_TOKEN` repository secret) for `StephanBaum/n8n-nodes-payload-cms`.
2. Create a GitHub Release (e.g., `v1.0.0`) to automatically build, lint, test, and publish `n8n-nodes-payload-cms` to npm with provenance.
3. Submit the published npm package in the [n8n Creator Portal](https://creators.n8n.io/) to make it searchable and installable directly inside n8n Cloud and self-hosted instances.

### Local Development & Testing in n8n
```bash
npm install
npm run build
npm run lint
npm test
```

To link this package into a local n8n instance:
```bash
npm link
cd ~/.n8n/custom
npm link n8n-nodes-payload-cms
n8n start
```

## License

[MIT](LICENSE.md)
