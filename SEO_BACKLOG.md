# SEO Backlog — screenplayeditor.app

Tenu par la loop SEO (Claude). Une amélioration par itération, la plus impactante d'abord.
Audit initial : 2026-07-04. État de base : title + meta description + canonical présents sur
toutes les pages publiques, JSON-LD sur index + compare/*, robots.txt propre (pages internes
disallow), URLs propres servies par Cloudflare Pages, canonical absorbe le doublon /x.html.

## Fait

- [x] **Sitemap : `/resources/screenplay-format-google-docs` manquait** (page « Complete Guide 2026 », grosse requête). Ajouté priority 0.9. (2026-07-04)
- [x] **JSON-LD sur les 14 pages resources/** : `Article` + `BreadcrumbList` partout
  (dates réelles tirées de git, auteur Hugo Thomas pour l'E-E-A-T), `FAQPage` sur les
  2 guides à FAQ visible, `CollectionPage` sur le hub. HowTo volontairement écarté
  (rich results supprimés par Google en 2023). (2026-07-04)

- [x] **JSON-LD blog** : `BlogPosting` + `BreadcrumbList` sur les 2 essais, `Blog` sur
  blog.html (l'article addons était déjà balisé). (2026-07-04)

## À faire (classé par impact)
- [x] **Open Graph + Twitter cards sur toutes les pages publiques** : 45 pages taguées
  (og:type article/website, og:site_name, title nettoyé du suffixe, description, url
  canonique, twitter:card), schools.html complété. Image de partage `og-image.png`
  1200×630 créée depuis hero-screenshot-flat (crop centré). Prochain raffinement
  possible : og:image dédiée par grande page (template, compare). (2026-07-04)
- [x] **Liens internes normalisés vers les URLs canoniques** : 286 hrefs `.html`
  (+ cancel/success) réécrits en chemins propres absolus. Avant, chaque clic et chaque
  crawl interne passaient par la redirection 308 de Cloudflare Pages. Audit au passage :
  les hubs resources/compare/blog maillent bien leurs enfants. (2026-07-04)
- [ ] **Orphelines restantes (décision produit à valider avec Hugo)** : les 10
  landing-*.html (pages de campagne, zéro lien entrant, mais dans le sitemap) ;
  /sceneboard et /filmstill (produits à part). Options : bloc footer « Who it's for »,
  ou les sortir du sitemap et assumer le noindex de fait.
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
