# Bankroll Algo — Deploy Guide
## Get live in ~20 minutes. Follow every step in order.

---

## STEP 1 — Get your free accounts (5 min)

1. **Vercel** → https://vercel.com → Sign up with GitHub (free)
2. **Upstash** → https://upstash.com → Sign up (free) — this stores your daily signal
3. **Anthropic API** → https://console.anthropic.com → Sign up, go to "API Keys", create a key
   - Add ~$5 credit (costs pennies per signal)

---

## STEP 2 — Set up Upstash Redis (3 min)

1. In Upstash dashboard → click **Create Database**
2. Name it: `bankroll-algo`
3. Region: `us-west-1` (closest to Los Angeles)
4. Click **Create**
5. On the database page, copy these two values — you'll need them shortly:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

---

## STEP 3 — Deploy to Vercel (5 min)

1. Go to https://vercel.com/new
2. Click **"Deploy from template"** → skip → choose **"Import from zip"**
   - OR: drag the `bankroll-algo-v2` folder onto the Vercel dashboard
3. Project name: `bankroll-algo`
4. Click **Deploy** — wait ~1 minute

---

## STEP 4 — Add your secret environment variables (5 min)

This is the most important step. In Vercel:

1. Go to your project → **Settings** → **Environment Variables**
2. Add these one by one:

| Variable Name               | Value                            |
|-----------------------------|----------------------------------|
| `ANTHROPIC_API_KEY`         | your key from console.anthropic.com |
| `UPSTASH_REDIS_REST_URL`    | from Upstash dashboard           |
| `UPSTASH_REDIS_REST_TOKEN`  | from Upstash dashboard           |
| `MEMBER_PASSWORD`           | password you share with members  |
| `ADMIN_PASSWORD`            | your private admin password      |

⚠️  Choose strong passwords. Members get MEMBER_PASSWORD. Only you know ADMIN_PASSWORD.

3. After adding all 5, click **Redeploy** in Vercel → Deployments tab

---

## STEP 5 — Test it (2 min)

1. Visit your live site (e.g. `bankroll-algo.vercel.app`)
2. Click **"Unlock Access"** in the purple banner
3. Enter your MEMBER_PASSWORD → you should see full TP/SL/RR
4. Reload → enter ADMIN_PASSWORD → you should see Admin Controls panel

---

## STEP 6 — Connect custom domain (optional, 5 min)

1. Buy `bankrollalgo.com` at https://namecheap.com (~$12/yr)
2. In Vercel → Settings → Domains → Add your domain
3. Follow Vercel's DNS instructions (copy 2 records to Namecheap)
4. Live within 10 minutes

---

## HOW THE AUTO-SIGNAL WORKS

The signal generates automatically at **6:00 AM PT every weekday (Mon–Fri)**
via a Vercel Cron Job defined in `vercel.json`.

The cron schedule `"0 13 * * 1-5"` = 1:00 PM UTC = 6:00 AM PT.

✅ No action needed from you — it runs automatically before every market open.

If you want to manually regenerate (e.g. after a news event):
- Log in with your ADMIN_PASSWORD
- Click **"Regenerate Signal Now"** in the Admin Controls panel

---

## PASSWORDS — HOW TO SHARE

- **Members**: Give them the MEMBER_PASSWORD (share via Discord, DM, etc.)
- **You**: Use the ADMIN_PASSWORD (never share this)
- To change passwords: go to Vercel → Settings → Environment Variables → edit → Redeploy

---

## QUESTIONS?

If anything breaks, the most common fix is:
→ Vercel → Settings → Environment Variables → make sure all 5 are set → Redeploy
