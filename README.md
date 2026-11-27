# إلى تقى مصطفى — Toqa Mostafa

A quiet, hand-built digital gift: an opening screen, a short editorial page of words,
a letter, and a closing dedication — with one supplied song.

No frameworks, no build step, no external runtime assets. Plain HTML, CSS and
vanilla JavaScript, ready for GitHub Pages.

---

## 1. What is inside

| Path | Purpose |
| --- | --- |
| `index.html` | The whole page: opening gate, hero, words, letter, final section |
| `css/styles.css` | Design system, layout, animation, responsive and reduced-motion rules |
| `js/app.js` | Opening sequence, music player, canvas dust, scroll reveals, progress bar |
| `assets/audio/garee2a-awy-a-colors-show.mp3` | The supplied track (unmodified) |
| `assets/fonts/*.woff2` | Self-hosted Arabic + Latin subsets (Aref Ruqaa, Amiri, Tajawal, Cormorant Garamond), 440 KB total |
| `assets/img/` | Favicon, Apple touch icon, social preview image |
| `README.md` | This file |
| `.nojekyll` | Tells GitHub Pages to publish files as-is |
| `.github/workflows/deploy.yml` | Optional Pages deployment workflow |

Everything is referenced with **relative paths** (`./css/...`, `./assets/...`), so the
site works from a user/organisation Pages URL *and* from a project subpath such as
`https://<user>.github.io/<repo>/` without any configuration change.

---

## 2. Local preview

The page must be served over HTTP (opening `index.html` from the file system blocks
audio in most browsers).

```bash
# from the project root
python -m http.server 8000
# then open http://localhost:8000
```

Any static server works: `npx serve .`, `php -S localhost:8000`, VS Code Live Server, etc.

---

## 3. Deploying to GitHub Pages

**Option A — branch-based Pages (matches this repo's workflow)**

1. Push the review branch: `feature/toqa-romantic-website`.
2. Open the repository on GitHub → **Settings** → **Pages**.
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (after merge) — or `feature/toqa-romantic-website` for a preview
   - **Folder**: `/ (root)`
4. Save. The site appears at
   `https://<user>.github.io/<repo>/` after the first build (about a minute).

**Option B — GitHub Actions**

The repository includes `.github/workflows/deploy.yml`, which publishes the
repository root as-is. No build step is involved.

1. **Settings** → **Pages** → **Build and deployment** → **Source**: `GitHub Actions`.
2. Push to `main` (or run the workflow manually from the **Actions** tab).
3. The workflow uploads the repo root and deploys it.

Note: the workflow triggers on `main` only. To preview the review branch before
merging, use Option A with `feature/toqa-romantic-website` as the Pages branch.

**Notes**

- `.nojekyll` is included; do not remove it.
- No absolute (`/assets/...`) paths are used, so a project subpath is safe.
- The audio file is ~1.2 MB and is committed as a normal asset, not via Git LFS.

---

## 4. The music

- The supplied file is used exactly as given (byte-identical copy), at
  `assets/audio/garee2a-awy-a-colors-show.mp3`.
- Playback starts **only** after the visitor presses «افتحي هديتك», which satisfies
  mobile autoplay policies.
- The header player toggles play/pause, exposes `aria-pressed`, and announces state
  changes through a polite live region.
- Volume fades in over ~1.6 s instead of starting abruptly.
- Decorative "equalizer" bars animate only while audio is actually playing.
- If the file is missing, blocked, interrupted or undecodable, the page stays fully
  usable: a quiet toast explains the problem, the player shows an `error` state, and
  the opening hint changes to say music is unavailable.
- The track loops. Pausing is remembered for the session only (no storage is used).

---

## 5. Design and typography

Palette: warm ivory and cream base, soft blush, rose-gold accents, muted lavender and
mauve, deep burgundy for emphasis and the closing panel.

Type:

- **Aref Ruqaa** — display Arabic (names, section titles, closing lines).
- **Amiri** — the quotes and the letter body, for a calligraphic reading tone.
- **Tajawal** — UI and interface copy (player, navigation, hints).
- **Cormorant Garamond** — small Latin labels and numerals. One upright file
  serves weights 300–400 (the two Google subsets are byte-identical this way).

Arabic text is set without `letter-spacing` (tracking breaks cursive joining); Latin
labels use wide tracking instead. Numerals in cards are Arabic-Indic (٠١…٠٦).

Motion: entrance reveals on scroll via `IntersectionObserver`, a slow canvas dust/
heart field, slowly drifting light washes, and a hand-drawn SVG arch scene. Every
animation is disabled under `prefers-reduced-motion: reduce`.

---

## 6. Accessibility

- Semantic landmarks (`main`, `header`, `section`, `footer`), each section labelled.
- The opening screen is a labelled modal dialog; the main experience is `inert` and
  `aria-hidden` until it opens, then focus moves to the hero heading.
- Skip link, visible `:focus-visible` rings, keyboard-operable button and nav.
- Live regions announce music state; nothing important is conveyed by colour alone.
- Text contrast targets WCAG AA on the ivory and burgundy surfaces.
- Canvas and SVG decoration are `aria-hidden`; the page is readable with JS disabled
  (the words, letter and closing are plain HTML).

---

## 7. Browser support

Modern evergreen browsers: Chrome/Edge 100+, Safari 15.4+, Firefox 100+.
Tested at 1440×900, 834×1112, 414×896, 390×844 and 320×700 with no horizontal
overflow and no console errors.

`overflow: clip` is progressive; `overflow-x: hidden` remains as the fallback.

---

## 8. Customising

| Change | Where |
| --- | --- |
| Colours, spacing, radii | `:root` custom properties at the top of `css/styles.css` |
| Quotes | `.card__quote` blocks in `index.html` |
| Letter text | `.letter__body` in `index.html` |
| Track | replace `assets/audio/garee2a-awy-a-colors-show.mp3` and the `<audio src>` |
| Social preview | `assets/img/og-image.png` (1200×630) |

---

## 9. A note on tone

The copy is deliberately calm: gratitude, respect and warmth, without promises the
sender cannot keep. If you edit the letter, keep that register — it is what makes the
page feel sincere rather than staged.
