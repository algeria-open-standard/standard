# Format `.xx` 0.1 : titre du secteur

Copiez ce dossier sous `formats/<identifiant>/` pour proposer un format. Un
format ne définit que ses données : le conteneur, les segments, les empreintes
et les cachets sont ceux du [socle](../../spec/core.md) et ne se redéfinissent
pas.

| | |
| --- | --- |
| Identifiant | lettres minuscules, chiffres et tirets : `inv`, `acc`, `edu`… |
| Extension | `.<identifiant>` |
| Type de média | `application/vnd.aos.<identifiant>+zip` |
| Profils | un profil par usage : ce qu'est le fichier et de quoi il parle |
| Socle requis | AOS 0.1 |

## Ce qu'une proposition contient

1. **À quoi il sert.** Qui émet le fichier, qui le porte, qui le reçoit, et
   pourquoi il passe par plusieurs émetteurs, s'il le fait.
2. **Les parties.** Pour chaque type `<identifiant>.<nom>` : ce qu'il contient,
   s'il est obligatoire, et son schéma JSON dans `schema/`.
3. **Ce que le format ne porte pas**, et pourquoi. C'est aussi important que le
   reste : dites quelles données personnelles ou sensibles restent dehors.
4. **Les règles propres au format** : ce qu'un vérificateur contrôle en plus du
   socle (par exemple, que tous les segments parlent du même sujet).
5. **Le vocabulaire** dans `vocab/` : les codes communs, en français et en
   arabe, sans règle ni taux qui changerait avec la loi.
6. **Des exemples** dans `examples/` : des fichiers scellés avec des clés
   d'essai, et le programme qui les construit.
7. **Des tests** qui jugent les exemples et refusent ce qui doit l'être.
8. **Le fondement légal** de chaque règle qui en a un, avec le texte et
   l'article, lus à la source.

## Questions à trancher avant d'écrire

- De qui ou de quoi parle un fichier ? Une personne, une entreprise, une
  opération ?
- Qui en est le porteur, et que peut-il vouloir retenir ? Découpez les parties
  en conséquence.
- Un format existe-t-il déjà pour ce besoin, en Algérie ou ailleurs ? S'il
  existe, le reprendre ou s'y raccorder vaut mieux qu'en inventer un.
- Quelles autorités reçoivent déjà ces données, et sous quelle forme ?

## Une fois accepté

Le format est inscrit dans [registry/formats.json](../../registry/formats.json)
à l'état `draft`.
