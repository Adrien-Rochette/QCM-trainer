# Format JSON QuizLab — version 1

Un fichier QuizLab contient un ou plusieurs sujets. Il est validé entièrement avant l’import : si une seule erreur est trouvée, rien n’est importé et chaque erreur est indiquée avec son emplacement (ex. « Sujet 1 › Question 3 › QCM › Bonne réponse 1 »).

## Structure

```json
{
  "format": "quizlab",
  "version": 1,
  "subjects": [
    {
      "id": "facultatif",
      "title": "Titre du sujet",
      "description": "Facultative",
      "category": "Facultative",
      "questions": [ /* … */ ]
    }
  ]
}
```

| Champ | Obligatoire | Règle |
|---|---|---|
| `format` | oui | toujours `"quizlab"` |
| `version` | oui | `1` |
| `subjects` | oui | au moins un sujet |
| `subjects[].title` | oui | 1 à 120 caractères |
| `subjects[].id`, `description`, `category` | non | — |
| `sessions` | non | historique, présent dans les sauvegardes complètes |

## Question

Chaque question a une version `mcq` (QCM), une version `cloze` (texte à trous), ou les deux.

```json
{
  "id": "facultatif-mais-unique",
  "difficulty": "facile",
  "tags": ["capitales"],
  "mcq": {
    "prompt": "Quelle est la capitale de la France ?",
    "choices": [
      { "id": "a", "text": "Lyon" },
      { "id": "b", "text": "Paris" }
    ],
    "correctIds": ["b"]
  },
  "cloze": {
    "text": "La capitale de la France est ___.",
    "blanks": [{ "answers": ["Paris"] }]
  },
  "explanation": "Affichée après la réponse."
}
```

**QCM (`mcq`)**
- `prompt` : énoncé, non vide.
- `choices` : au moins 2 propositions ; les `id` et les textes doivent être uniques.
- `correctIds` : au moins une bonne réponse, chacune correspondant à un `id` de `choices`. Avec plusieurs bonnes réponses, le quiz affiche des cases à cocher ; la réponse n’est juste que si l’ensemble exact est coché.

**Texte à trous (`cloze`)**
- `text` : la phrase, où chaque blanc s’écrit avec au moins trois tirets bas `___`.
- `blanks` : une entrée par blanc, dans l’ordre. `answers` liste les formulations acceptées ; la première est affichée comme réponse attendue.
- La comparaison ignore les majuscules et les espaces en trop. Les accents peuvent être ignorés via une option de session. Il n’y a pas de correspondance approximative.
- Le format accepte plusieurs blancs par phrase ; l’éditeur en crée un par défaut.

**Facultatifs** : `difficulty` (`"facile"`, `"moyen"` ou `"difficile"`), `tags` (liste de textes), `explanation` (texte ; les portions entre `accents graves` s’affichent comme du code), `source`.

## Identifiants et collisions

Les `id` sont facultatifs : QuizLab les crée si besoin. Si un sujet du fichier a le même `id` qu’un sujet existant, l’import propose deux choix :
- **Importer comme copie** : nouveaux identifiants, le sujet existant n’est pas touché.
- **Remplacer** : les questions du sujet existant sont remplacées, l’historique est conservé.

## Générer un fichier avec une IA

Donnez ce document et votre cours à l’IA, puis demandez : « Produis un fichier JSON au format QuizLab v1 avec N questions sur … ». Importez ensuite le fichier : les éventuelles erreurs seront signalées précisément.
