# R. E. Smith Author Website (starter build)

This is a custom website and book-catalog application built from the supplied Wix Books CSV export (59 records). It is designed to run on Cloudflare Workers + D1. It does **not** change your Wix site or domain.

## Included
- Public author homepage using the ivory, charcoal, and antique-gold visual direction.
- Responsive book catalog with search, series/genre/status filters, newest-first sorting, and featured books.
- Reusable book-detail modal with Amazon and Google Books links.
- Private dashboard at `/admin.html` with add/edit/delete, CSV import, and CSV export.
- D1 schema and an initial seed migration for the 59 exported books.
- Generic cover placeholders. Existing Wix cover URLs are deliberately not used as the new permanent cover files; add your preferred local covers later.

## Important
This is a deployable starter project, not yet published. Do not use Cloudflare's **Upload your static files** deployment for this project: the private dashboard needs server-side API routes and a D1 database. Deploy the project as a Worker with static assets.

## Recommended setup (one-time)
You will need a GitHub account and Cloudflare account. The easiest repeatable route is Cloudflare Workers Builds connected to a GitHub repository. Alternatively, a developer can deploy it using Wrangler.

### A. Put the project in GitHub
1. Create a **private** GitHub repository named `resmith-author-site`.
2. Upload the contents of this folder (not the ZIP file itself) into the repository.
3. In Cloudflare, open **Workers & Pages** and create a Worker connected to that GitHub repository, using the repository root as the project directory.
4. The build/deploy command is `npx wrangler deploy`. Build command can be left empty. If Cloudflare asks for a build output directory, this is a Worker project, not a static-only Pages site.

### B. Create the D1 database
From a terminal with Node.js installed, in the project folder:
```bash
npm install -g wrangler
npx wrangler login
npx wrangler d1 create resmith-books
```
Cloudflare will print a database ID. Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with that ID.

Then run:
```bash
npx wrangler d1 migrations apply resmith-books --remote
npx wrangler deploy
```
The migrations create the table and load the 59 books. The seed uses `INSERT OR IGNORE`, so rerunning it does not overwrite existing records.

### C. Set the private admin token
Generate a long random token (password-manager generated is best), then run:
```bash
npx wrangler secret put ADMIN_TOKEN
```
Paste the token when prompted. Redeploy if Cloudflare requests it. The token is checked server-side; the browser only holds it in session storage while the dashboard is open. Do not put it in source files or GitHub.

### D. Verify
- Public website: the Worker URL shown by Cloudflare.
- Dashboard: add `/admin.html` to that URL.
- Sign in with the `ADMIN_TOKEN`.
- Confirm the 59 imported books appear before connecting `resmithauthor.com`.

## Book cover images
The starter uses a designed placeholder for each book. The dashboard currently supports a cover image URL. A later step can add private R2-backed image upload so you can select cover files directly from your PC. Do not connect the domain or remove the Wix site until the new site has been tested.

## CSV import
The dashboard accepts CSV headers matching the Wix export field names, and the included import logic recognizes the Wix `image` JSON column. If an imported row contains an existing `id`, it updates that record; if no ID exists, it creates a new record. Always keep the original CSV backup.

## Before going live
- Confirm each book's Amazon and Google Books links.
- Confirm the public visibility rules for publication status and draft/unpublished books. Currently the catalog shows all records so the catalog can be checked during development.
- Add R2 cover uploads and stronger admin access (Cloudflare Access is a good additional protection).
- Add backups for the D1 database.
- Test on desktop and mobile.
- Only after approval, connect the Wix-registered domain by changing DNS. Keep the Wix registration active.

## Project files
- `public/`: website pages, styles, scripts, seed JSON for local fallback.
- `src/worker.js`: API and static-asset routing.
- `migrations/0001_schema.sql`: database structure.
- `migrations/0002_seed_books.sql`: the 59 book records.
- `wrangler.toml`: Worker, assets, and D1 configuration.
