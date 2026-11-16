# QuizLab

Application de révision par QCM et textes à trous, sur n’importe quel sujet. Elle fonctionne entièrement dans le navigateur, sans serveur ni compte, et reste utilisable hors ligne une fois installée.

## Installation et démarrage

Prérequis : Node.js 20 ou plus récent.

```bash
npm install      # installe les dépendances
npm run dev      # lance l’application en développement → http://localhost:5173
npm run build    # compile la version de production dans dist/
npm run preview  # sert la version compilée → http://localhost:4173
npm run test     # lance les tests unitaires
```

Pour l’installer comme une application (PWA), ouvrez la version compilée (`npm run build` puis `npm run preview`) dans Chrome ou Edge, puis cliquez sur l’icône « Installer » de la barre d’adresse. Elle fonctionne ensuite sans connexion.

## Utilisation

1. **Accueil** : choisissez un sujet. Deux sujets de démonstration sont installés au premier lancement : Géographie et Python.
2. **Mode** : QCM, Compléter (texte à trous) ou Mixte.
3. **Réglages** : nombre de questions, difficulté, ordre, chronomètre (temps écoulé ou temps limité par question), « Réviser uniquement mes erreurs », « Ignorer les accents ».
4. **Quiz** : répondez puis cliquez sur « Valider » ; la correction et l’explication s’affichent.
   Raccourcis clavier : touches `1` à `9` pour cocher, `Entrée` pour valider puis passer à la suite.
5. **Résultats** : score, détail par type de question, récapitulatif, boutons « Recommencer » et « Revoir mes erreurs ».
6. **Statistiques** : quiz réalisés, scores moyens et meilleurs, évolution, questions souvent ratées.
7. **Gestion** : créer, renommer, dupliquer, exporter ou supprimer un sujet. L’éditeur permet d’ajouter des questions sans écrire de JSON, avec un aperçu avant enregistrement.
8. **Importer** : chargez un fichier `.json` (glisser-déposer ou copier-coller).

Les données sont enregistrées dans le navigateur (IndexedDB). Pour les sauvegarder ou les transférer, utilisez **Gestion → Sauvegarde complète**, puis réimportez le fichier.

## Banques de questions fournies

| Fichier | Contenu |
|---|---|
| `sujets/thermodynamique-td0-td2.json` | Thermodynamique, chapitres 1-2 et TD 0 à 2 : 67 questions (59 QCM, 26 à trous) |
| `public/exemples/histoire-de-france.json` | Exemple : Histoire de France, 13 questions |

Pour charger un fichier : **Importer → Choisir un fichier**.

## Format JSON

Le format est documenté dans [docs/FORMAT-JSON.md](docs/FORMAT-JSON.md). Il est versionné, permet de produire des banques de questions avec un outil externe ou une IA, et ne demande aucune modification du code.

## Architecture

```
src/
  models/      types TypeScript et schémas de validation Zod
  engine/      moteur de quiz : sélection des questions, correction, score, déroulement
  db/          base IndexedDB (Dexie), opérations de lecture/écriture, données de démo
  io/          import/export JSON (validation, collisions d’identifiants)
  stats/       calcul des statistiques
  app/         routeur, thème, notifications, confirmations, session en cours
  components/  composants d’interface (ui, quiz, éditeur, statistiques, mise en page)
  pages/       une page par écran
  data/        sujets de démonstration
```

La logique métier (`engine`, `io`, `stats`, `db`) ne dépend pas de React et est couverte par les tests (`*.test.ts`).

Technologies : React 19, TypeScript (typage strict), Vite, Tailwind CSS 4, Lucide, Dexie, Zod, Vitest, vite-plugin-pwa.
