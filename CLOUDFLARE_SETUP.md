# Cloudflare setup (one time)

Unzip over your project root (it replaces `src/App.tsx`, `src/components/StaffLeadsPortal.tsx`,
`src/components/CosmeticDentistryPage.tsx`, and adds `src/services/leadsStore.ts`, `functions/`,
`schema.sql`, `wrangler.toml`).

1. `npm i -g wrangler` then `wrangler login`
2. `wrangler d1 create nimma-clinic-db` → copy the printed `database_id` into `wrangler.toml`
3. `wrangler d1 execute nimma-clinic-db --remote --file=schema.sql`
4. Cloudflare dashboard → Workers & Pages → your Pages project → Settings:
   - **Bindings** → Add → D1 database → variable name `DB` → `nimma-clinic-db`
   - **Variables and Secrets** → add secret `STAFF_INITIAL_PASSWORD` (choose a NEW password — the old
     default was visible in the website's JavaScript, so don't reuse it)
   - Save for Production, then redeploy
5. Build command `npm run build`, output directory `dist`. `functions/` deploys automatically.
6. Open `/#staff-portal`, log in with the initial password, then use the key icon to set your real one.
   After the first change the initial secret is no longer accepted.

## Test locally with the real backend
`npm run build && npx wrangler pages dev dist --d1=DB`
Create a `.dev.vars` file containing `STAFF_INITIAL_PASSWORD=choose-something` first.
(`npm run dev` alone has no `/api`, so forms and login need the command above.)

## Notes
- Forgot the password? Reset it by deleting the stored hash, then log in with the initial secret again:
  `wrangler d1 execute nimma-clinic-db --remote --command "DELETE FROM settings WHERE key='staff_password_hash'"`
- Login is limited to 5 wrong tries per IP per 15 minutes.
- Old leads saved in staff browsers' localStorage are not migrated.
- Recommended: add a Cloudflare WAF rate-limiting rule on `POST /api/leads` to deter form spam.
