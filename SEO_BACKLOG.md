# SEO Backlog — screenplayeditor.app

Tenu par la loop SEO (Claude). Une amélioration par itération, la plus impactante d'abord.
Audit initial : 2026-07-04. État de base : title + meta description + canonical présents sur
toutes les pages publiques, JSON-LD sur index + compare/*, robots.txt propre (pages internes
disallow), URLs propres servies par Cloudflare Pages, canonical absorbe le doublon /x.html.

## Fait

- [x] **Sitemap : `/resources/screenplay-format-google-docs` manquait** (page « Complete Guide 2026 », grosse requête). Ajouté priority 0.9. (2026-07-04)

## À faire (classé par impact)

- [ ] **JSON-LD sur les 13 pages resources/** : `Article` ou `HowTo` pour les guides,
  `FAQPage` si la page a une section questions. Candidates aux rich results, ce sont les
  pages qui rankent. Commencer par how-to-write-screenplay-google-docs et
  screenplay-format-google-docs.
- [ ] **JSON-LD `BlogPosting` sur les 3 articles de blog** + `Blog` sur blog.html.
- [ ] **Open Graph + Twitter cards sur toutes les pages publiques** (seuls index.html et
  schools.html ont og:title). Gabarit commun : og:title, og:description, og:image
  (créer une image de partage 1200×630 réutilisable), og:url, twitter:card summary_large_image.
  ~40 pages, faisable en 2-3 itérations (resources → compare/landings → reste).
- [ ] **Maillage interne** : vérifier que index.html et les landings pointent vers
  /resources (hub) et les compare ; que chaque template page pointe vers le guide principal
  et inversement. Les pages orphelines ne rankent pas.
- [ ] **Nouvelle page contenu par requête non couverte** (une par itération) : idées à
  valider avec volume réel : « fountain syntax guide », « how to format dialogue in a
  screenplay », « screenplay page count / pages per minute », « courier vs courier new
  screenplay font », « how to write a logline ». Toujours human-voice, toujours un lien
  naturel vers l'add-on/extension.
- [ ] **Poids des images** : hero-screenshot.png et les PNG de features sont lourds ;
  passer en WebP + `loading="lazy"` sous la ligne de flottaison + `alt` descriptifs partout.
- [ ] **`lastmod` dans le sitemap** sur les pages de contenu (aide au recrawl des guides
  mis à jour).
- [ ] **Blog : title tags trop longs** (les deux articles dépassent 60 caractères affichés
  en SERP) ; raccourcir sans perdre la voix.
- [ ] **Audit Search Console** (demander accès à Hugo ou passer par lui) : requêtes où on
  est en position 5-20 = les vraies priorités de contenu ; remplacer ce backlog « à
  l'aveugle » par les données réelles dès que possible.

## Notes de contexte

- Concurrent direct : screenplayer.ai (talon d'Achille : parser PDF ; notre moat : le doc
  reste dans Google Docs). Les pages compare/ sont l'arme.
- Extension Chrome = pari n°1 de Hugo : les nouvelles pages de contenu doivent pousser
  l'extension d'abord quand c'est pertinent.
- Header du site = UN web component (`/header.js`), ne jamais recoder un `<header>`.
- Copie visible : règles human-voice (verbes partout, pas de tirets cadratins, pas de
  formules IA).
