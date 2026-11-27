# AOS Cachets 0.1

État : brouillon. Les mots DOIT, NE DOIT PAS, DEVRAIT et PEUT ont le sens de la
RFC 2119.

Ce document dit comment un émetteur scelle un segment et comment un cachet se
vérifie. Savoir **à qui** appartient la clé d'un cachet est une autre question,
traitée dans [trust.md](trust.md).

## 1. Cachet et signature

La loi algérienne distingue deux actes (loi n° 26-02, art. 2) :

- le **cachet électronique**, créé par une personne morale, « pour garantir
  l'origine et l'intégrité » des données ;
- la **signature électronique**, créée par une personne physique.

Une entreprise qui émet un dossier appose donc un **cachet**. C'est le cas
ordinaire du standard. Une personne physique peut y ajouter sa signature (un
responsable des ressources humaines, par exemple) : la mécanique est la même,
seul le champ `aosKind` change.

## 2. Ce qui est scellé

Un cachet porte sur les octets de `segment.json`, tels qu'ils sont dans
l'archive ([core.md](core.md), 3.2). L'en-tête contient l'empreinte de chaque
partie et celle de l'en-tête précédent : sceller l'en-tête, c'est sceller tout
le segment et son rattachement à la chaîne.

## 3. La forme

`seals.json` suit la sérialisation JSON générale de JWS (RFC 7515, 7.2.1), avec
la charge utile détachée (RFC 7515, annexe F) : le membre `payload` est absent,
la charge utile est le fichier `segment.json`.

```json
{
  "signatures": [
    { "protected": "<en-tête protégé, base64url>", "signature": "<base64url>" }
  ]
}
```

L'entrée à signer est celle de JWS :
`ASCII(protected) || "." || BASE64URL(octets de segment.json)`.

N'importe quelle bibliothèque JWS vérifie donc un cachet AOS. C'est voulu : un
éditeur qui adopte le standard n'écrit pas de cryptographie.

### JWS et la paire de clés

Un cachet AOS **est** une signature à clé privée et clé publique : l'émetteur
signe avec sa clé privée, tout le monde vérifie avec sa clé publique. JWS n'est
pas un autre mécanisme, c'est l'enveloppe normalisée qui range cette signature
dans un fichier : quel algorithme, quelle clé, quels octets, dans quel ordre.
Sans enveloppe commune, chaque éditeur rangerait la même signature à sa façon
et aucun ne lirait celle de l'autre.

Deux précisions, parce que la confusion est fréquente :

- **signer n'est pas chiffrer.** Chiffrer cache un contenu à ceux qui n'ont pas
  la clé ; signer prouve qui l'a émis et qu'il n'a pas changé, sans rien cacher.
  Un cachet ne rend pas le dossier secret ;
- **on ne « chiffre » pas avec la clé privée.** Cette image vient de RSA et ne
  vaut pour aucun algorithme moderne. Ed25519 et ECDSA sont des algorithmes de
  signature : ils ne chiffrent rien.

### 3.1 L'en-tête protégé

| Paramètre | Valeur |
| --- | --- |
| `alg` | `EdDSA` ou `ES256` |
| `typ` | `aos-seal+jws` |
| `kid` | L'empreinte de la clé publique : RFC 7638, SHA-256, base64url |
| `jwk` | La clé publique, et elle seule |
| `aosKind` | `seal` (personne morale) ou `signature` (personne physique) |
| `aosRole` | `issuer` pour l'émetteur du segment |
| `x5c` | Facultatif : la chaîne de certificats X.509, quand la clé est certifiée par un prestataire |

Tous ces paramètres sont obligatoires, sauf `x5c`. Tout ce qui précède est
couvert par le cachet. Le membre non protégé `header`
est réservé aux preuves ajoutées après coup (`aosEvidence`, voir 6) : rien de ce
qu'il contient n'est couvert, et un vérificateur NE DOIT PAS s'y fier pour
décider de la validité du cachet.

### 3.2 Les algorithmes

| `alg` | Algorithme | Exigence |
| --- | --- | --- |
| `EdDSA` | Ed25519 (RFC 8032, RFC 8037) | Tout vérificateur DOIT le vérifier. C'est le choix par défaut pour sceller. |
| `ES256` | ECDSA P-256 avec SHA-256 (RFC 7518) | Tout vérificateur DOIT le vérifier. Pour les clés tenues dans du matériel et les certificats X.509. |

Aucun autre algorithme n'est permis en 0.1. En particulier `none`, les
algorithmes symétriques (`HS256`…) et RSA avec le remplissage PKCS#1 v1.5 sont
refusés. La liste est fermée : elle s'allonge par une révision du standard,
jamais par le contenu d'un fichier.

Ed25519 est préféré parce que ses signatures sont déterministes (aucun aléa à
la signature, donc aucune fuite de clé par un mauvais générateur) et qu'il n'a
pas de paramètre à mal choisir.

Un segment PEUT porter plusieurs cachets. C'est ce qui permettra de resceller
un segment ancien avec un algorithme plus récent sans le réécrire, le jour où
un algorithme faiblira (voir 7).

## 4. Vérifier un cachet

Pour chaque entrée de `signatures`, un vérificateur DOIT, dans cet ordre :

1. décoder l'en-tête protégé ; refuser si ce n'est pas un objet JSON, ou s'il
   porte deux fois le même membre ;
2. refuser si `typ` n'est pas `aos-seal+jws`, si `aosKind` n'est ni `seal` ni
   `signature`, ou si `aosRole` manque : rien n'est supposé à la place du
   cachet ;
3. refuser si `alg` n'est pas dans la liste de 3.2 ;
4. refuser si l'en-tête porte `crit` ;
5. refuser si `jwk` est absent ou porte une clé privée (`d`) ;
6. refuser si `alg` n'est pas l'algorithme du type de la clé (une clé Ed25519
   ne vérifie que `EdDSA`) : l'algorithme n'est jamais laissé au choix du
   fichier ;
7. refuser si `kid` n'est pas l'empreinte de `jwk` ;
8. vérifier la signature sur l'entrée de JWS, avec les octets de `segment.json`
   lus dans l'archive.

Un segment est scellé s'il porte au moins un cachet valide de genre `seal` et
de rôle `issuer`.

Ce que ces étapes établissent : **les octets de l'en-tête sont ceux qu'a scellés
le détenteur de cette clé.** Rien de plus. Un faussaire peut refaire un fichier
et le sceller de sa propre clé : la cryptographie sera juste. C'est l'étape
suivante, celle de la confiance, qui le démasque.

## 5. Ce que dit un vérificateur

Trois questions, trois réponses séparées. Un outil NE DOIT PAS les fondre en un
seul « valide ».

| Question | Réponses |
| --- | --- |
| **Intégrité** : a-t-on changé quelque chose depuis le cachet ? | intacte, rompue |
| **Chaîne** : les segments se suivent-ils, et le début est-il là ? | complète, incomplète, rompue |
| **Origine** : qui a scellé, pour autant que le vérificateur le sache ? | connue, inconnue, refusée |

« Origine inconnue » n'est pas une erreur : le fichier est intact, mais le
vérificateur ne connaît pas la clé. « Origine refusée » en est une : la clé est
connue et n'appartient pas à l'émetteur que le segment nomme, ou elle était
révoquée ou hors validité à la date du segment.

## 6. Le temps

`createdAt` est la date que l'émetteur déclare. Elle vaut ce que vaut sa
parole. Cela compte dans un cas précis : si une clé est compromise, celui qui
l'a volée peut sceller un faux et l'antidater à une époque où la clé était
valide.

La parade est une preuve de date faite par un tiers, jointe au cachet dans
`header.aosEvidence` :

- un jeton d'horodatage RFC 3161, délivré par un prestataire d'horodatage ;
- un reçu d'inscription dans un journal public ([trust.md](trust.md), 5).

La version 0.1 réserve cet emplacement et ne définit pas encore le contenu des
preuves. Sans preuve de date, un vérificateur DEVRAIT dire que la date est celle
qu'a déclarée l'émetteur, en particulier quand la clé a été révoquée depuis.

## 7. La durée

Un dossier de carrière se lit pendant quarante ans. Trois choses s'usent avant :

- **les clés expirent et se remplacent.** Une clé ancienne reste vérifiable tant
  que son histoire (périodes de validité, révocation) reste publiée. Une clé NE
  DOIT JAMAIS être effacée d'un annuaire, seulement close ;
- **les entreprises disparaissent.** Ce qu'un émetteur suivant a constaté des
  cachets précédents (`previous.seals`) et les preuves de date tiennent lieu de
  mémoire ;
- **les algorithmes faiblissent.** Un segment peut recevoir un cachet
  supplémentaire d'un algorithme plus récent, ou une preuve de date qui établit
  que le cachet d'origine existait avant que son algorithme ne soit cassé. La
  liste de 3.2 est faite pour s'allonger, y compris vers les algorithmes
  résistants au calcul quantique quand ils seront normalisés dans JWS.

## 8. La garde des clés

1. Une clé privée est créée par son détenteur, sur une machine qu'il maîtrise,
   et n'en sort pas. Personne ne crée la clé d'un autre.
2. Une clé qui scelle au nom d'une entreprise DEVRAIT être tenue dans un
   matériel dont elle ne peut pas être extraite (module de sécurité, carte,
   service de gestion de clés).
3. Quand un logiciel en ligne scelle pour ses clients, chaque client a sa
   propre clé, tenue à part des autres, et le logiciel NE DOIT PAS pouvoir
   sceller pour un client sans un acte de ce client. Le champ `producer` de
   l'en-tête dit quel logiciel a scellé.
4. Une clé soupçonnée d'être compromise est révoquée aussitôt, avec la date à
   partir de laquelle elle ne doit plus être crue.
5. Une clé a une durée de vie, que son détenteur fixe et publie avec elle. Elle
   est remplacée avant son terme, et l'ancienne reste publiée comme close.

## 9. Menaces et réponses

| Ce que quelqu'un tente | Ce qui l'arrête |
| --- | --- |
| Changer une donnée d'une partie | L'empreinte de la partie dans l'en-tête |
| Changer la donnée et l'empreinte | Le cachet de l'en-tête |
| Refaire le fichier et le sceller de sa propre clé | La confiance : la clé n'est pas celle de l'émetteur nommé |
| Sceller de sa vraie clé un segment au nom d'un autre | L'émetteur nommé doit être le détenteur de la clé |
| Ajouter un fichier dans un segment scellé | Tout fichier d'un segment doit être listé dans l'en-tête |
| Remplacer ou déplacer un segment | L'empreinte du précédent dans chaque en-tête |
| Retirer le premier segment | Détecté : la chaîne est dite incomplète |
| Retirer le dernier segment | **Non détecté** par le fichier seul ([core.md](core.md), 4) |
| Faire choisir un algorithme faible ou `none` | La liste fermée, et l'algorithme lié au type de la clé |
| Glisser deux entrées du même nom, un chemin qui sort de l'archive, une archive qui gonfle | Les règles du conteneur ([core.md](core.md), 2) |
| Antidater avec une clé volée | Une preuve de date par un tiers ; sans elle, non détecté |
| Lire un fichier intercepté | **Rien en 0.1** : le fichier est en clair |
