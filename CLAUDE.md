# Voyage à Rome — application familiale partagée

## Le projet
Petite application web pour organiser un voyage en famille à Rome, **du 26 au 30 décembre**.
Les 5 voyageurs consultent et modifient les **mêmes données**, chacun depuis son téléphone ou
son ordinateur, **sans avoir à créer de compte**.

## Les voyageurs (et leur rôle)
- **Solange**, la grand-mère, ancienne professeure de lettres classiques : partage des articles,
  des vidéos et les visites qu'elle juge prioritaires.
- **Emmanuelle**, la mère (propriétaire du projet, non développeuse) : transports et hôtels.
- **Jean-Laurent**, le père : idées de visites, de restaurants, d'activités.
- **Héloïse** (21 ans) et **Thomas** (16 ans) : consultent et proposent des idées.

## Fonctionnalités (3 onglets)
1. **Programme** : visites, restaurants et activités.
   - Statut : `à réserver` → `réservé` → `fait`
   - Une étoile « prioritaire » (pour les incontournables de Solange)
   - Date, heure, prix, lien et note facultatifs, et le nom de la personne qui a fait la proposition
   - « Retirer du programme » ne supprime pas : l'idée passe dans « Idées sans date, à placer » (en bas), avec toutes
     ses informations, et son ancien jour est gardé (`jourAvant`) : il est pré-rempli quand on la remet au programme. La suppression définitive
     n'est proposée que pour une idée déjà « Idées sans date, à placer ».
   - Deux vues (choix mémorisé sur l'appareil) : **📋 Aperçu** (par défaut : une ligne par activité, jour
     par jour, compteur « 🟠 N réservations encore à faire » qui filtre, lien vers les idées sans date) et
     **🗂️ Détail** (les cartes). Toucher une journée ou une activité de l'aperçu ouvre le détail à cet endroit.
   - Titres de journées (« Vatican »…) : collection `voyages/{code}/jours`, un document par date
     (identifiant `2026-12-26`…) avec `titre`. Affichés dans l'aperçu et le détail, modifiables par ✏️ dans le détail.
   - **Variantes** (A, B, C) : le champ `variante` d'une activité liste les lettres des variantes où elle figure
     ("A", "BC", "AB"…) ou "" si elle est commune à toutes. Noms dans `VARIANTES` (app.js).
     Sélecteur en haut du Programme (choix mémorisé sur l'appareil), visible seulement s'il existe des
     activités planifiées propres à une variante. Titres des journées variables : documents `2026-12-27-A`…
     « ✅ Adopter la variante » supprime les activités planifiées de l'autre et rend la variante commune.
   - « ⚡ Ajouter plusieurs idées d'un coup » : des noms séparés par des virgules (ou retours à la ligne)
     créent une carte chacun dans « Idées sans date, à placer » ; les noms déjà présents (sans tenir compte
     des majuscules ni des accents) sont ignorés ; on choisit le type et « Proposé par ».
2. **À lire / à voir** : articles, vidéos et livres partagés, qu'on peut rattacher à une visite
   du Programme. Chaque personne coche « lu / vu ».
   Sur la carte d'une visite du Programme, un raccourci « 📚 N choses à lire / à voir » ouvre l'onglet.
3. **Infos pratiques** : trains et vols, hôtels (adresses, horaires, numéros de réservation).

Les valises et les dépenses ont été écartées volontairement. Ne pas les ajouter sans demande.

## Architecture (validée par Emmanuelle)
- **La page** : HTML + CSS + JavaScript « pur », sans framework ni étape de compilation.
  Fichiers : `index.html`, `style.css`, `app.js`.
  Icône : `icone.svg` (dessin source) → `icone-512.png`, `icone-192.png`, `apple-touch-icon.png` (180 px),
  `favicon-32.png`, générées avec Chrome (capture) puis `sips`. Ouverture plein écran depuis l'écran
  d'accueil via les balises `apple-mobile-web-app-capable` / `mobile-web-app-capable`. Pas de manifeste
  volontairement : son `start_url` ferait perdre le code secret après le `#`.
  Mode d'emploi : `guide.html` (ouvert dans l'appli par « ❓ Mode d'emploi ») et sa version PDF
  `Mode-d-emploi-Rome-en-famille.pdf` (à joindre aux messages). Les mettre à jour quand une fonction change.
  Le PDF se refait avec Chrome : `--headless=new --print-to-pdf` sur `guide.html` servi en local.
- **Le code** est versionné avec **Git** et stocké sur **GitHub**.
- **L'hébergement** se fait sur **GitHub Pages** (gratuit) : chaque envoi sur GitHub met le site à jour.
  Dépôt : `EMAJL-cmd/voyage-rome`. Site : https://emajl-cmd.github.io/voyage-rome/
- **Les données partagées** sont dans **Firebase Firestore** (Google, offre gratuite « Spark »,
  sans carte bancaire). Mise à jour en direct : les autres voient les changements sans recharger.
- **Pas de comptes** pour la famille :
  - Accès par un **lien secret** : le code du voyage est placé dans l'adresse
    (ex. `…/#rome-xxxxxxxx`). Les données sont rangées sous ce code dans Firestore, et les
    règles de sécurité interdisent de lister les voyages existants.
  - Le **code secret ne doit jamais apparaître dans le code source** : le dépôt GitHub est public.
    La configuration Firebase (clé « apiKey » publique) peut, elle, y figurer : c'est normal.
  - Le code est aussi gardé sur l'appareil (`localStorage`, clé `code`) : si un raccourci d'écran d'accueil
    perd la fin de l'adresse, l'application le retrouve.
  - À la première visite, la page demande « Qui êtes-vous ? » (choix parmi les 5 prénoms) et
    s'en souvient sur l'appareil (`localStorage`).
- Le lien secret complet est dans `lien-secret.txt` (ignoré par Git, ne jamais le publier ni l'afficher).
- Les règles de sécurité sont dans `firestore.rules`. Elles ne sont PAS publiées automatiquement :
  après chaque modification, Emmanuelle doit les recoller dans la console Firebase
  (Firestore → Règles → Publier). Penser à ajouter toute nouvelle rubrique à la liste autorisée.
- Organisation des données Firestore : `voyages/{code}/programme`, `…/ressources`, `…/infos`, `…/jours`.
- La base est vide au départ : la page doit l'afficher proprement, avec des messages du type
  « Aucune visite pour l'instant ».

## Règles pour Claude
- Emmanuelle n'est pas développeuse : tout expliquer en français simple. Si un mot technique
  est indispensable, l'expliquer.
- Avancer par **petites étapes**, une fonctionnalité à la fois, et faire tester avant de continuer.
- Les créations de comptes (GitHub, Firebase) sont faites par Emmanuelle elle-même, guidée pas à pas.
- Rester simple : aucune bibliothèque ni aucun outil supplémentaire (hors Firebase) sans l'avoir
  proposé et justifié d'abord.
- Interface en français, dates au format `26 déc.`
- Concevoir d'abord pour le téléphone (≈ 375 px), puis vérifier sur ordinateur.
- Gros boutons faciles à toucher (Solange doit s'y retrouver).
- Formulaires : plein écran sur téléphone, « Annuler » et « Enregistrer » dans un en-tête collant en haut
  (toujours visibles clavier ouvert). Le clavier ne doit pas s'ouvrir tout seul à l'ouverture d'un formulaire.
- **Sécurité** : toute personne qui a le lien peut lire et modifier les données. Ne jamais y stocker
  de numéros de passeport, de carte bancaire ni de mots de passe. Les numéros de réservation sont
  acceptables.
- **À chaque publication**, augmenter le numéro de version `?v=N` dans `index.html` (style.css, app.js)
  et dans l'import de `firebase-config.js` (app.js). Sinon, les téléphones gardent jusqu'à 10 minutes
  d'anciens fichiers en mémoire, mélangés aux nouveaux, et la page peut rester blanche.
- Mise à jour automatique : à chaque retour sur l'application (et 5 s après l'ouverture), `app.js` compare
  sa version (`?v=N` de sa propre adresse) à celle d'`index.html` en ligne et recharge si elle a changé
  (une seule tentative par version). Le numéro « Version N » s'affiche en bas de la page.
- Les écoutes Firestore en erreur ne se relancent pas seules : prévoir une nouvelle tentative (voir
  `ecouterTitresJours`), surtout pour une rubrique qui dépend de règles à publier par Emmanuelle.
- Faire un commit Git à la fin de chaque étape validée, avec un message clair en français.

## Avancement
- [x] Étape 0 — Préparatifs : dossier du projet, compte GitHub, projet Firebase
- [x] Étape 1 — Page « Bonjour Rome » publiée sur GitHub Pages et ouverte sur téléphone
- [x] Étape 2 — Branchement de Firebase et test de partage avec un membre de la famille
- [x] Étape 3 — Squelette : 3 onglets, choix « Qui êtes-vous ? »
- [x] Étape 4 — Programme
- [ ] Étape 5 — À lire / à voir (en ligne, à tester)
- [ ] Étape 6 — Infos pratiques (en ligne, vols et logement saisis, à tester)
- [ ] Étape 7 — Finitions et test sur les téléphones de la famille
