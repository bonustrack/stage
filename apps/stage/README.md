# Stage landing (stage.box)

Minimal, dependency-free static site for the Stage product domain. 1-bit
black/white dither aesthetic to match the app onboarding. No build step, no
JS frameworks, no telemetry.

## Files

- `index.html` — landing page: wordmark, one-line pitch, feature chips,
  a "Get the app" CTA, and OG/Twitter meta tags for link unfurls.
- `user/index.html` — `/user/<addr>` open-in-app interstitial. Tries the
  `stage://user/<addr>` deep link on load (mirrors `apps/ui/public/preview-launcher.html`),
  falls back to the "Get the app" landing button. The app's deep-link parser
  (`apps/app/lib/deepLinks.ts`) maps `stage://user/<addr>` to the profile screen.
- `og.png` — 1200x630 unfurl image (dither crop).
- `_redirects` — clean-URL rewrite so `/user/<addr>` serves `user/index.html`.
- `netlify.toml` — site config (no build, publish this dir).

## Parameterize the CTA

The "Get the app" button (`#get-app` in `index.html`) currently points at
`https://stage.box/get`. Update its `href` to the Play closed-test / APK URL
when the public listing exists.

## Deploy (Netlify) — needs Less

stage.box is NOT wired to Netlify yet (apps/ui = metro.box is the existing
site). Create a SECOND Netlify site:

1. New site from the `bonustrack/metro` repo.
2. Base directory: `apps/stage`; build command empty; publish `apps/stage`.
3. Add custom domain `stage.box` and point DNS at the Netlify site
   (Netlify DNS, or an ALIAS/ANAME at the registrar for the apex).

Until the dedicated site exists, this PR's deploy preview (if Netlify runs on
the PR) renders from the existing metro.box site config and will not pick up
`apps/stage/netlify.toml` automatically — confirm the preview path or attach
the dedicated site.
