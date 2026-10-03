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
2. **À lire / à voir** : articles, vidéos et livres partagés, qu'on peut rattacher à une visite
   du Programme. Chaque personne coche « lu / vu ».
3. **Infos pratiques** : trains et vols, hôtels (adresses, horaires, numéros de réservation).

Les valises et les dépenses ont été écartées volontairement. Ne pas les ajouter sans demande.

## Architecture (proposée, à valider par Emmanuelle)
- **La page** : HTML + CSS + JavaScript « pur », sans framework ni étape de compilation.
  Fichiers : `index.html`, `style.css`, `app.js`.
- **Le code** est versionné avec **Git** et stocké sur **GitHub**.
- **L'hébergement** se fait sur **GitHub Pages** (gratuit) : chaque envoi sur GitHub met le site à jour.
- **Les données partagées** sont dans **Firebase Firestore** (Google, offre gratuite « Spark »,
  sans carte bancaire). Mise à jour en direct : les autres voient les changements sans recharger.
- **Pas de comptes** pour la famille :
  - Accès par un **lien secret** : le code du voyage est placé dans l'adresse
    (ex. `…/#rome-xxxxxxxx`). Les données sont rangées sous ce code dans Firestore, et les
    règles de sécurité interdisent de lister les voyages existants.
  - Le **code secret ne doit jamais apparaître dans le code source** : le dépôt GitHub est public.
    La configuration Firebase (clé « apiKey » publique) peut, elle, y figurer : c'est normal.
  - À la première visite, la page demande « Qui êtes-vous ? » (choix parmi les 5 prénoms) et
    s'en souvient sur l'appareil (`localStorage`).
- Organisation des données Firestore : `voyages/{code}/programme`, `…/ressources`, `…/infos`.
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
- **Sécurité** : toute personne qui a le lien peut lire et modifier les données. Ne jamais y stocker
  de numéros de passeport, de carte bancaire ni de mots de passe. Les numéros de réservation sont
  acceptables.
- Faire un commit Git à la fin de chaque étape validée, avec un message clair en français.

## Avancement
- [ ] Étape 0 — Préparatifs : dossier du projet, compte GitHub, projet Firebase
- [ ] Étape 1 — Page « Bonjour Rome » publiée sur GitHub Pages et ouverte sur téléphone
- [ ] Étape 2 — Branchement de Firebase et test de partage avec un membre de la famille
- [ ] Étape 3 — Squelette : 3 onglets, choix « Qui êtes-vous ? »
- [ ] Étape 4 — Programme
- [ ] Étape 5 — À lire / à voir
- [ ] Étape 6 — Infos pratiques
- [ ] Étape 7 — Finitions et test sur les téléphones de la famille
