# La méthode

Comment le standard change : qui propose, ce qu'une proposition doit contenir,
qui décide, et à quelles conditions un format devient stable. Cette méthode
s'applique à elle-même : la changer est une proposition.

Les mots DOIT, NE DOIT PAS, DEVRAIT et PEUT ont le sens de la RFC 2119.

## 1. Cinq sortes de changement

Tout changement n'a pas le même poids. La sorte dit le chemin à suivre.

| Sorte | Exemples | Chemin | Relecture | Délai de revue |
| --- | --- | --- | --- | --- |
| **A. Correction** | Une faute, une phrase ambiguë, un test manquant, sans changer ce qu'un fichier valide est | Demande de fusion | 1 mainteneur | aucun |
| **B. Vocabulaire** | Un code de rubrique de paie, un schéma d'identifiant, une sorte de document | Demande de fusion motivée | 2 relecteurs de deux organisations | 7 jours |
| **C. Évolution d'un format** | Une partie nouvelle, un champ nouveau, une règle nouvelle | Proposition | Mainteneurs du format | 21 jours |
| **D. Nouveau format** | `.inv`, `.edu`… | Proposition complète | Comité | 30 jours |
| **E. Socle, cachets, confiance, méthode** | Le conteneur, les algorithmes, la chaîne, l'annuaire, ce document | Proposition, avec revue de sécurité | Comité, à la majorité des deux tiers | 45 jours |

En cas de doute sur la sorte, c'est la plus lourde qui s'applique.

## 2. Le chemin d'une proposition

```
idée → brouillon → revue → décision → mise en œuvre
```

1. **Idée.** Ouvrez une discussion sur le dépôt : le besoin, qui il concerne,
   ce qui existe déjà. Personne n'écrit de spécification avant que le besoin
   soit reconnu par au moins une autre organisation que celle qui propose.
2. **Brouillon.** Copiez [proposals/0000-modele.md](../proposals/0000-modele.md)
   sous `proposals/NNNN-titre-court.md`, où `NNNN` est le numéro suivant, et
   ouvrez une demande de fusion. La proposition porte l'état `brouillon`.
3. **Revue.** Un mainteneur passe la proposition à l'état `revue` quand elle
   est complète. Le délai de la sorte court à partir de ce jour. Toute
   objection reçoit une réponse écrite dans la proposition, qu'elle soit
   retenue ou non.
4. **Décision.** À la fin du délai, ceux qui décident (section 6) acceptent,
   refusent ou renvoient en brouillon. La décision et ses raisons sont écrites
   dans la proposition. Une proposition refusée reste dans le dépôt : elle
   évite de refaire le même débat.
5. **Mise en œuvre.** La spécification, les schémas, les exemples et les tests
   sont fusionnés **ensemble**. Une règle sans test n'entre pas.

## 3. Les états d'un format

Un format porte un état dans [registry/formats.json](../registry/formats.json).

| État | Ce qu'on peut en attendre | Pour y entrer |
| --- | --- | --- |
| `draft` | Peut changer sans préavis | La proposition est acceptée |
| `candidate` | Figé, sauf défaut. Cherche des mises en œuvre | Voir 3.1 |
| `stable` | Ne change plus que de façon compatible | Voir 3.2 |
| `retired` | N'est plus à émettre ; reste lisible | Une proposition de retrait, avec ce qui le remplace |

### 3.1 Devenir candidat

- la spécification ne contient plus de « à préciser » ;
- chaque partie a son schéma, chaque code son libellé en français et en arabe ;
- des fichiers d'exemple scellés existent, avec le programme qui les construit
  à l'octet près ;
- les tests jugent les exemples et refusent ce qui doit l'être ;
- la mise en œuvre de référence passe ces tests.

### 3.2 Devenir stable

- **deux mises en œuvre indépendantes**, écrites par deux organisations
  différentes, jugent tous les exemples de la même façon et lisent chacune les
  fichiers de l'autre ;
- au moins une les utilise en production ;
- la revue de sécurité et la revue des données personnelles (section 5) sont
  faites et publiées ;
- chaque règle qui a un fondement légal cite le texte et l'article, lus à la
  source.

Deux mises en œuvre qui se comprennent sont la seule preuve qu'une
spécification dit ce qu'elle croit dire. C'est la condition qui ne se négocie
pas.

## 4. Ce qu'un nouveau format doit montrer

Une proposition de sorte D part de [formats/_template/](../formats/_template/README.md)
et répond à chacun de ces points.

1. **Le besoin.** Qui échange quoi avec qui aujourd'hui, et ce qui ne marche
   pas.
2. **Ce qui existe.** Un standard répond-il déjà au besoin, en Algérie ou
   ailleurs ? S'il en existe un, la proposition dit pourquoi le reprendre tel
   quel, s'y raccorder, ou s'en écarter. Inventer n'est jamais le premier
   choix.
3. **Les rôles.** Qui émet, qui porte, qui vérifie. Pourquoi un fichier passe
   par plusieurs émetteurs, s'il le fait.
4. **Le sujet.** De qui ou de quoi parle un fichier, et comment un vérificateur
   sait que tous les segments parlent du même.
5. **Les parties**, découpées selon ce que le porteur peut vouloir retenir.
6. **Ce que le format ne porte pas**, et pourquoi.
7. **Les autorités.** Qui reçoit déjà ces données, sous quelle forme, et si le
   format doit s'y raccorder.
8. **Le fondement légal** de chaque règle qui en a un.
9. **Les exemples et les tests.**
10. **Deux organisations** prêtes à le mettre en œuvre.

Un identifiant de format compte de deux à huit lettres minuscules, ne reprend
pas une extension de fichier déjà répandue, et se réserve dans le registre dès
l'acceptation.

## 5. Les deux revues

### 5.1 Sécurité

Obligatoire pour la sorte E, et pour tout format avant l'état stable. Elle
répond par écrit : qu'est-ce qu'un porteur malveillant, un émetteur malveillant
et un tiers qui intercepte peuvent tenter, et qu'est-ce qui les arrête ? La
table des menaces de [spec/seal.md](../spec/seal.md) est tenue à jour avec.

Un changement qui touche aux algorithmes, au conteneur ou à la chaîne est relu
par au moins une personne qui n'a pas participé à l'écrire.

### 5.2 Données personnelles

Obligatoire pour tout format qui porte des données de personnes. Elle répond :
quelles données, pour quel usage, lesquelles sont sensibles au sens de la loi
n° 18-07, ce que le porteur peut retenir, ce que l'existence d'une partie
révèle, et ce qui reste à la charge de celui qui émet et de celui qui reçoit.

## 6. Qui décide

Les rôles sont dans [GOVERNANCE.md](../GOVERNANCE.md).

| Sorte | Décide | Comment |
| --- | --- | --- |
| A | Un mainteneur | Seul |
| B | Les mainteneurs du format | Consensus ; à défaut, majorité |
| C | Les mainteneurs du format | Consensus ; à défaut, renvoi au comité |
| D | Le comité | Consensus ; à défaut, majorité simple |
| E | Le comité | Majorité des deux tiers |

Le consensus est l'absence d'objection maintenue et motivée, pas l'unanimité.
Une objection qui ne dit pas ce qui la lèverait ne bloque pas.

## 7. Les versions et la compatibilité

- Une version s'écrit `majeur.mineur`. Le socle et chaque format ont la leur.
- **Mineur** : on ajoute sans casser. Un champ facultatif nouveau, une partie
  facultative nouvelle, un code nouveau. Un fichier valide avant reste valide.
- **Majeur** : tout le reste. Un champ qui devient obligatoire, un sens qui
  change, une règle qui se durcit.
- Un lecteur lit une partie avec le schéma de la version qu'elle déclare. S'il
  ne connaît pas cette version mineure, il lit ce qu'il connaît, garde le reste
  tel quel, et le dit.
- Personne ne convertit le segment d'un autre : le convertir romprait son
  cachet. Un fichier peut donc porter des segments de versions différentes,
  pour toujours.
- Un code de vocabulaire n'est jamais retiré ni réutilisé pour un autre sens.
  Il peut être marqué déconseillé, avec celui qui le remplace.
- Avant la version 1.0 d'un format, tout peut changer d'une version à l'autre.

## 8. Les extensions

Un éditeur n'a pas à attendre le standard pour porter ce dont il a besoin.

1. **Le préfixe.** Un éditeur réserve son préfixe dans
   [registry/vendors.json](../registry/vendors.json) par une demande de fusion
   de sorte A : `x-<préfixe>`. Premier arrivé, premier servi.
2. **Ce qu'il peut étendre.** Un type de partie (`x-<préfixe>.<nom>`), un code
   de vocabulaire (`x-<préfixe>-<nom>`), un schéma d'identifiant
   (`x-<préfixe>:<nom>`).
3. **Ce qu'une extension ne peut pas faire.** Changer le sens d'un champ du
   standard ; être nécessaire pour lire le fichier ; toucher au conteneur, aux
   empreintes ou aux cachets ; porter des données que le format exclut.
4. **Ce que fait un lecteur.** Il garde ce qu'il ne connaît pas, tel quel, et
   le signale. Il ne le supprime pas et ne le refuse pas.
5. **La promotion.** Une extension que deux éditeurs utilisent pour le même
   besoin a vocation à entrer dans le standard : c'est une proposition de sorte
   B ou C, qui lui donne son nom définitif. Le nom en `x-` reste lisible.

## 9. Les mises en œuvre

Une mise en œuvre qui passe les exemples d'un format s'inscrit dans
[registry/implementations.json](../registry/implementations.json) : son nom,
son éditeur, son langage, les formats et les versions qu'elle lit et écrit, et
la date de son dernier passage des exemples. C'est cette liste qui dit si un
format a ses deux mises en œuvre indépendantes.

## 10. Les défauts de sécurité

Un défaut ne s'écrit pas en public : voir [SECURITY.md](../SECURITY.md). Sa
correction suit la sorte de changement qu'elle représente, en privé jusqu'à ce
que les adoptants aient pu mettre à jour, puis elle est publiée avec son
histoire.
