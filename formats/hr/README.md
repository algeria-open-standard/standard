# Format `.hr` 0.1 : ressources humaines et paie

État : brouillon. Les mots DOIT, NE DOIT PAS, DEVRAIT et PEUT ont le sens de la
RFC 2119.

| | |
| --- | --- |
| Identifiant | `hr` |
| Extension | `.hr` |
| Type de média | `application/vnd.aos.hr+zip` |
| Profil défini | `employee-file` : le dossier d'un salarié |
| Socle requis | AOS 0.1 ([socle](../../spec/core.md), [cachets](../../spec/seal.md), [confiance](../../spec/trust.md)) |

## 1. À quoi il sert

Un salarié quitte une entreprise. Elle lui remet son dossier dans un fichier
`.hr`, qu'elle scelle. Il le donne à son nouvel employeur, qui vérifie le cachet
et lit le dossier dans son propre logiciel, quel qu'il soit. Quand il repart,
ce second employeur ajoute sa part au même fichier et la scelle à son tour. Le
fichier grandit ainsi d'un segment par employeur, chacun répondant de ce qu'il a
écrit.

Le même fichier sert à passer d'un logiciel de paie à un autre : exporté de
l'un, importé dans l'autre.

Un fichier `.hr` de profil `employee-file` parle d'**une seule personne**.

## 2. Les parties

Chaque segment est ce qu'un employeur dit de la personne pour la période où elle
a travaillé chez lui.

| Type | Fichier conseillé | Obligatoire | Contenu | Schéma |
| --- | --- | --- | --- | --- |
| `hr.identity` | `parts/identity.json` | oui | Qui est la personne | [identity](schema/identity.schema.json) |
| `hr.employment` | `parts/employment.json` | oui | L'employeur, l'entrée, la sortie, les contrats, les postes | [employment](schema/employment.schema.json) |
| `hr.payroll` | `parts/payroll/<année>.json` | non | Les bulletins de paie d'une année | [payroll](schema/payroll.schema.json) |
| `hr.leave` | `parts/leave.json` | non | Le congé annuel à une date | [leave](schema/leave.schema.json) |
| `hr.documents` | `parts/documents.json` | non | Ce que sont les documents joints | [documents](schema/documents.schema.json) |
| `file` | `files/…` | non | Un document joint : PDF, image | |

Chaque partie JSON porte son propre `type` et sa `version`, égaux à ceux que
l'en-tête du segment déclare pour elle.

Les bulletins sont rangés par année, une partie par année, pour que la personne
puisse en donner certaines et en retenir d'autres.

### 2.1 `hr.identity`

Le nom et les prénoms en caractères latins, tels que sur la pièce d'identité,
et en arabe s'ils sont connus ; la date de naissance ; les identifiants de la
personne (`dz:nin`, `dz:nss`). Les coordonnées sont facultatives et DEVRAIENT
être omises si rien ne les demande.

`birth.presumed` vaut vrai quand l'état civil ne donne que l'année de
naissance : le jour et le mois valent alors `01-01`.

### 2.2 `hr.employment`

L'employeur tel qu'il était pendant la période (dénomination, forme, numéros),
le matricule, la date d'entrée, la date de sortie (`null` tant que la personne
est en poste), les contrats successifs et les postes occupés avec leurs
périodes.

Ces quatre mentions (entrée, sortie, postes, périodes) sont celles du certificat
de travail que la loi fait délivrer à la fin de la relation de travail (loi
n° 90-11, art. 67). Une partie `hr.employment` scellée porte donc, sous une
forme lisible par une machine, ce que dit ce certificat.

`leavingReason` est facultatif et NE DEVRAIT être rempli que si la personne le
demande : le motif du départ ne figure pas parmi les mentions du certificat de
travail.

### 2.3 `hr.payroll`

Pour chaque mois, les lignes du bulletin et ses totaux.

Une ligne a un `code`, qui dit ce qu'elle est d'un logiciel à l'autre, et un
`label`, qui est le libellé imprimé sur le bulletin. Les codes communs sont dans
[vocab/pay-elements.json](vocab/pay-elements.json) ; une rubrique propre à un
éditeur s'écrit `x-<éditeur>-<nom>`. Un logiciel qui importe DOIT garder les
lignes dont il ne connaît pas le code, avec leur libellé.

Le format décrit des bulletins **tels qu'ils ont été établis**. Il ne porte
aucune règle de calcul et aucun taux en vigueur : ceux-ci viennent de la loi et
changent avec elle. Un logiciel qui importe NE DOIT PAS recalculer un bulletin
reçu.

Un montant est une chaîne décimale à deux chiffres après le point
(`"45000.00"`), jamais un nombre flottant. La monnaie est dite une fois par
partie (`currency`, ISO 4217).

### 2.4 `hr.leave`

Le droit, la consommation et le solde du congé annuel payé à une date, avec la
période de référence.

### 2.5 `hr.documents` et les fichiers joints

Un document joint est un fichier de `files/`, listé dans l'en-tête du segment
avec son empreinte, comme toute partie. `hr.documents` dit ce qu'est chacun :
certificat de travail, contrat, avenant, bulletin, diplôme, attestation de
formation.

## 3. Ce que le format ne porte pas

La version 0.1 ne définit **aucune** partie pour :

- les données de santé : arrêts de maladie, visites médicales, handicap ;
- les sanctions et la discipline ;
- le casier judiciaire ;
- les appréciations et les évaluations.

Ce sont des données qu'un employeur suivant n'a pas à recevoir, ou que la loi
sur les données personnelles entoure de conditions qu'un fichier qui circule ne
peut pas garantir. Un émetteur NE DOIT PAS les glisser dans une partie
existante ni dans un fichier joint.

## 4. Les règles propres au format

En plus de la vérification du socle, un vérificateur de `.hr` DOIT contrôler :

1. **Les parties obligatoires.** Chaque segment liste une partie `hr.identity`
   et une partie `hr.employment`.
2. **Une seule personne.** Deux segments parlent de la même personne s'ils
   donnent le même `dz:nin` quand tous deux en donnent un ; à défaut, le même
   nom, les mêmes prénoms et la même date de naissance. Un segment qui parle de
   quelqu'un d'autre rend le fichier invalide.
3. **L'identité retenue.** Si le porteur a retenu `hr.identity` d'un segment,
   le vérificateur le signale : il ne peut pas dire à qui ce segment se
   rapporte.

Un vérificateur DEVRAIT aussi signaler, sans les refuser, les chevauchements et
les trous entre les périodes d'emploi des segments : c'est ce qui montre qu'un
employeur manque à la chaîne. La mise en œuvre de référence ne le fait pas
encore.

## 5. Émettre

Un logiciel qui émet un `.hr` :

1. n'y met que les données de la personne et de sa relation de travail avec
   l'émetteur ;
2. écrit un segment par remise : s'il remet un nouveau fichier à la même
   personne plus tard, il ajoute un segment au fichier qu'elle lui présente, ou
   en commence un nouveau ;
3. scelle le segment avec la clé de l'entreprise ([cachets](../../spec/seal.md), 8) ;
4. remet le fichier à la personne, par un moyen protégé : le fichier est en
   clair en 0.1.

## 6. Recevoir

Un logiciel qui reçoit un `.hr` :

1. le vérifie avant d'en lire le contenu, et montre à l'utilisateur les trois
   réponses (intégrité, chaîne, origine) et les parties retenues ;
2. ne refuse pas un fichier dont l'origine est inconnue : il dit qu'elle l'est ;
3. garde le fichier reçu tel quel, octet pour octet : c'est lui qu'il faudra
   rendre, augmenté d'un segment ;
4. n'importe que ce dont il a l'usage, et le dit.

## 7. Les exemples

[examples/](examples/) contient le dossier d'un salarié fictif, Amine Benali :

| Fichier | Ce qu'il montre |
| --- | --- |
| `amine-benali-2026.hr` | Un segment, scellé par SARL Atlas Conseil |
| `amine-benali-2028.hr` | Le même, suivi d'un segment scellé par EURL Numidia Tech |
| `amine-benali-2028-sans-salaires.hr` | Le même, donné sans les bulletins de paie |
| `trust.json` | Les clés des deux entreprises, pour vérifier l'origine |
| `keys/` | **Des clés d'essai**, publiées exprès pour que chacun puisse refaire les fichiers |
| `build.mjs` | Le programme qui les construit, à l'octet près |

Tout y est inventé : les personnes, les entreprises, les numéros, et les
montants, qui ne sont pas un exemple de calcul de paie.

Toute mise en œuvre DOIT juger ces fichiers comme la mise en œuvre de
référence : valides, chaîne complète, origine connue avec `trust.json` et
inconnue sans.

## 8. Ce qui viendra

- Un profil pour l'export de tout le personnel d'une entreprise d'un logiciel à
  l'autre.
- La formation, les avenants, les éléments variables.
- Les contrôles de forme des numéros (NIN, numéro de sécurité sociale).
