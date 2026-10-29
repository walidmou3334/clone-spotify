# Vue Music

Application Vue 3 de recherche musicale avec Spotify Web API et lecteur Spotify Embed.

## Installation

Utiliser une version récente de Node.js compatible avec Vite 8 (Node 22.12+ ou 24).

```sh
npm ci
```

Conserver votre fichier `server/.env` existant. Pour une nouvelle installation, copier `server/.env.example` vers `server/.env`, puis renseigner les identifiants de votre application Spotify. Les secrets restent sur le serveur. Ils ne doivent pas être ajoutés à Git.

## Développement

Dans un premier terminal :

```sh
npm start
```

Dans un second terminal :

```sh
npm run dev
```

Ouvrir http://127.0.0.1:5173. Vite transmet les requêtes `/api` au backend sur le port 3001.

## Version compilée

```sh
npm run build
npm start
```

Ouvrir http://127.0.0.1:3001.

## Fonctionnalités

- Interface responsive avec filtres Chansons, Artistes et Albums.
- Six recherches récentes conservées localement dans le navigateur, avec relance et suppression de l'historique.
- Pagination, états de chargement et bouton de nouvelle tentative en cas d'erreur.
- Lecteur officiel Spotify et liens vers les résultats sur Spotify.

Le backend et le composant du lecteur sont inchangés. Le partage du code seul ne configure pas les identifiants du serveur : une nouvelle installation nécessite son propre fichier `server/.env` ou des variables d'environnement équivalentes.
