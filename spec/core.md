# AOS Socle 0.1

État : brouillon. Les mots DOIT, NE DOIT PAS, DEVRAIT et PEUT ont le sens de la
RFC 2119.

Ce document fixe ce que tous les formats du standard ont en commun : le
conteneur, les segments, les parties et leurs empreintes, les versions. Les
cachets sont dans [seal.md](seal.md), la confiance dans [trust.md](trust.md).

## 1. Le modèle

Un fichier AOS est une suite de **segments**. Un segment est ce qu'un
**émetteur** a écrit à un moment donné : ses données, et un en-tête qui les
liste. L'émetteur scelle l'en-tête. Le suivant ajoute son segment après les
autres, sans toucher aux précédents.

```
fichier
├── segment 1   émis par A   scellé par A
├── segment 2   émis par B   scellé par B, et qui nomme l'empreinte du segment 1
└── segment 3   émis par C   scellé par C, et qui nomme l'empreinte du segment 2
```

Trois rôles :

- l'**émetteur** écrit et scelle un segment ;
- le **porteur** détient le fichier (pour `.hr`, le salarié) : il peut le
  donner, entier ou sans certaines parties, mais ne peut rien y changer ;
- le **vérificateur** reçoit le fichier et juge ce qu'il vaut.

## 2. Le conteneur

Un fichier AOS est une archive ZIP.

1. La première entrée DOIT s'appeler `mimetype`, être stockée sans compression
   et sans champ supplémentaire, et contenir le type du fichier en ASCII, sans
   fin de ligne : `application/vnd.aos.<format>+zip`. Le type se lit ainsi à
   l'octet 38, sans rien décompresser.
2. Toute autre entrée DOIT être sous `segments/NNNN/`, où `NNNN` est le rang du
   segment sur quatre chiffres, à partir de `0001`.
3. Un chemin DOIT être relatif, séparé par `/`, sans segment vide, `.` ou `..`,
   sans `\`, sans lettre de lecteur, et de 512 octets au plus en UTF-8.
4. Deux entrées NE DOIVENT PAS porter le même nom.
5. Seules la compression « stockée » (0) et « deflate » (8) sont permises.
6. Le chiffrement ZIP, ZIP64, les archives sur plusieurs disques, les
   descripteurs de données et les commentaires d'archive NE DOIVENT PAS être
   utilisés. Rien NE DOIT se trouver entre deux entrées ni après la fin de
   l'archive.
7. Une archive compte au plus 10 000 entrées ; une entrée fait au plus 64 Mio
   une fois décompressée, et l'ensemble au plus 512 Mio. Un émetteur DOIT
   rester sous ces bornes.
8. Un lecteur DOIT refuser une archive qui enfreint une de ces règles, y
   compris une entrée `mimetype` compressée ou munie d'un champ supplémentaire.
   Les bornes sont les mêmes pour tous : un fichier ne doit pas être valide
   chez l'un et refusé chez l'autre.

Ces règles sont strictes à dessein : un fichier reçu d'un tiers est hostile tant
qu'il n'est pas prouvé sain, et deux lecteurs qui ne comprennent pas une archive
de la même façon ne vérifient pas le même fichier.

## 3. Le segment

```
segments/0001/segment.json    l'en-tête
segments/0001/seals.json      les cachets de l'en-tête
segments/0001/parts/…         les données, en JSON
segments/0001/files/…         les documents joints (PDF, images)
```

### 3.1 L'en-tête

`segment.json` est un objet JSON en UTF-8, conforme à
[schema/segment.schema.json](schema/segment.schema.json) :

| Champ | Sens |
| --- | --- |
| `aos` | La version du socle : `"0.1"` |
| `format` | `id`, `version`, et `profile` s'il y en a un |
| `sequence` | Le rang du segment, égal au nombre de son dossier |
| `id` | Un identifiant unique du segment, `urn:uuid:…` tiré au hasard |
| `createdAt` | La date et l'heure de l'émission telles que l'émetteur les déclare, en UTC, de la forme `2026-06-30T15:00:00Z` (RFC 3339, toujours avec `Z`, fractions de seconde permises) |
| `issuer` | L'émetteur : `name`, `country` (ISO 3166-1 alpha-2), `identifiers` |
| `producer` | Le logiciel qui a écrit le segment (facultatif) |
| `previous` | `null` pour un premier segment ; sinon le rang et l'empreinte de l'en-tête du segment précédent |
| `parts` | La liste des parties : `path`, `type`, `mediaType`, `size`, `digest` |

Un identifiant s'écrit `{ "scheme": "dz:nif", "value": "…" }`. Les schémas
communs sont dans [registry/identifier-schemes.json](../registry/identifier-schemes.json).
Deux identifiants désignent le même numéro quand leurs schémas sont égaux et
que leurs valeurs le sont, espaces et casse mis à part.

**Lire le JSON.** Les noms de membres sont exacts, casse comprise : `Issuer`
n'est pas `issuer`. Un objet NE DOIT PAS porter deux fois le même nom de
membre, et un lecteur DOIT refuser un en-tête, un fichier de cachets ou un
en-tête protégé de cachet où cela arrive. Sans cette règle, un lecteur
montrerait la première valeur et un autre la dernière, sous le même cachet
valide. Une date qui n'a pas exactement la forme dite est refusée de même.

### 3.2 Les octets font foi

Le cachet porte sur **les octets de `segment.json` tels qu'ils sont dans
l'archive**. Il n'y a pas de forme canonique à recalculer : un outil NE DOIT
JAMAIS relire puis réécrire un en-tête, et DOIT recopier un segment reçu octet
pour octet. C'est un choix : les formes canoniques de JSON sont une source
connue de désaccords entre mises en œuvre, et « on scelle ce qu'on écrit » n'en
laisse aucun.

### 3.3 Les parties

Chaque fichier d'un segment autre que `segment.json` et `seals.json` DOIT être
listé dans `parts`, avec sa taille et son empreinte. L'empreinte s'écrit
`sha-256:<hexadécimal en minuscules>` et porte sur les octets du fichier.
SHA-256 DOIT être accepté ; SHA-384 et SHA-512 PEUVENT l'être.

Pour le vérificateur, une partie est dans l'un de trois états :

| État | Sens |
| --- | --- |
| intacte | Le fichier est là et son empreinte est celle de l'en-tête |
| altérée | Le fichier est là et son empreinte diffère : le fichier est invalide |
| retenue | La partie est listée mais le fichier n'est pas là : le porteur ne l'a pas donnée |

Un fichier présent dans un segment et absent de `parts` rend le fichier
invalide : personne ne l'a scellé.

### 3.4 Retenir une partie

Le porteur PEUT retirer des parties d'un fichier avant de le donner. Les
cachets restent valides, puisqu'ils couvrent les empreintes et non les parties.
Le vérificateur voit lesquelles ont été retenues, par leur chemin et leur type.
`segment.json` et `seals.json` ne peuvent pas être retenus.

Conséquence à connaître : l'existence d'une partie se voit même quand elle est
retenue. Un format NE DEVRAIT PAS définir de partie dont la seule présence
révèle quelque chose de la personne.

## 4. La chaîne

Le segment de rang *n* > 1 porte dans `previous` le rang *n* − 1 et l'empreinte
de l'en-tête de ce segment. Comme cet en-tête contient lui-même les empreintes
de ses parties et celle du segment d'avant, le cachet du dernier segment couvre,
de proche en proche, tout ce qui précède.

Ce que scelle un émetteur :

- **ses propres données**, dont il répond ;
- **le fait qu'il a ajouté son segment à la suite de cette chaîne précise**,
  telle qu'il l'a reçue.

Il ne répond pas de l'exactitude de ce que les autres ont écrit. Il PEUT noter
dans `previous.seals` ce qu'il a constaté des cachets du segment précédent le
jour où il a ajouté le sien : c'est une trace utile le jour où une clé ancienne
n'est plus vérifiable.

Les segments présents dans un fichier DOIVENT se suivre sans trou. Seul le
début peut manquer : un segment absent au milieu rompt la chaîne.

Le vérificateur dit de la chaîne qu'elle est :

| État | Sens |
| --- | --- |
| complète | Elle part du rang 1 et chaque segment suit le précédent |
| incomplète | Le début manque : le premier segment présent en nomme un qui n'est pas là |
| rompue | Un segment ne suit pas celui qui le précède dans le fichier : le fichier est invalide |

Un vérificateur DEVRAIT signaler un segment daté d'avant celui qu'il suit : ce
n'est possible que si une date est fausse.

**Limite.** Rien dans un fichier ne dit qu'il existe un segment plus récent. Un
porteur peut donner une version ancienne de son fichier, sans le dernier
segment, et elle sera valide. Les dates de chaque segment le montrent à qui les
lit ; seul un registre extérieur pourrait le détecter, et le standard n'en
impose pas.

## 5. Les versions

- `aos` est la version du socle, `format.version` celle du format. Elles
  évoluent séparément.
- Une version s'écrit `majeur.mineur`. Un changement mineur ajoute sans casser :
  un lecteur de la version 1.2 lit un fichier 1.3 en ignorant ce qu'il ne
  connaît pas. Un changement majeur peut casser.
- Avant 1.0, tout peut changer d'une version à l'autre.
- Un fichier peut contenir des segments de versions différentes : chaque
  segment se lit avec la version qu'il déclare. Personne ne convertit le segment
  d'un autre, puisque le convertir romprait son cachet.

## 6. Les extensions

- Un type de partie propre à un éditeur s'écrit `x-<éditeur>.<nom>`. Un lecteur
  qui ne le connaît pas le garde tel quel et le dit.
- Un schéma d'identifiant ou un code de vocabulaire propre s'écrit `x-…`.
- Un format NE PEUT PAS changer le conteneur, l'en-tête, les empreintes ni les
  cachets.

## 7. Conformité

Une mise en œuvre est conforme au socle 0.1 si elle juge comme la mise en œuvre
de référence les fichiers d'exemple de chaque format, et refuse les fichiers
que les tests de `impl/js/test/` construisent pour être refusés.
