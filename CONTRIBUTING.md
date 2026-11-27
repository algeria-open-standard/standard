# Contribuer

Toute contribution est bienvenue : une faute relevée, une question qui révèle
une ambiguïté, une mise en œuvre dans un autre langage, un format nouveau.

## Par où commencer

| Vous voulez | Faites |
| --- | --- |
| Poser une question, signaler une ambiguïté | Ouvrez un ticket. Une règle que deux personnes lisent différemment est un défaut. |
| Corriger une faute ou préciser une phrase | Une demande de fusion. Un mainteneur suffit. |
| Ajouter un code de vocabulaire | Une demande de fusion motivée : ce que le code désigne, qui en a besoin, son libellé en français et en arabe. |
| Faire évoluer un format, en proposer un nouveau, toucher au socle | Une proposition : [la méthode](process/README.md). Commencez par une discussion. |
| Signaler un défaut de sécurité | **Pas en public** : [SECURITY.md](SECURITY.md). |
| Annoncer votre mise en œuvre | Ajoutez-la à [registry/implementations.json](registry/implementations.json). |
| Réserver un préfixe d'extension | Ajoutez-le à [registry/vendors.json](registry/vendors.json). |

## Les règles d'une demande de fusion

1. **La spécification, les schémas, les exemples et les tests changent
   ensemble.** Une règle sans test n'entre pas ; un test sans règle non plus.
2. **Les exemples se reconstruisent à l'octet près**, avec la version de Node
   de l'intégration continue (24). Après un changement :

   ```sh
   cd impl/js
   pnpm install
   node ../../formats/hr/examples/build.mjs
   pnpm test
   ```

   Si un fichier d'exemple change, dites pourquoi dans la demande.
3. **Chaque règle qui s'appuie sur la loi cite le texte et l'article**, lus à
   la source et non dans un résumé. Ce qui n'a pas pu être vérifié est dit.
4. **Aucune donnée réelle.** Les personnes, les entreprises et les numéros des
   exemples sont inventés.
5. **Aucune clé privée**, hormis les clés d'essai des exemples, nommées
   `*.test-key.json`.
6. **Chaque commit porte une ligne `Signed-off-by`** (`git commit -s`) : vous
   attestez que vous avez le droit d'apporter ce que vous apportez
   ([GOVERNANCE.md](GOVERNANCE.md), section 6).

## La langue

La spécification est écrite en français. Les identifiants (noms de champs,
codes, types) sont en anglais, en ASCII, pour être les mêmes dans tous les
langages. Les libellés des vocabulaires sont en français et en arabe.

Une traduction de la spécification est bienvenue. En cas d'écart, le texte
français fait foi.

## Le ton

On discute des textes, pas des personnes. On répond aux objections par écrit.
On dit ce qu'on n'a pas vérifié.
