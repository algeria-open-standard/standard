# Algeria Open Standard

Des formats ouverts pour que les logiciels algériens se comprennent : un dossier
sorti d'un logiciel se lit dans un autre, et celui qui le reçoit peut vérifier
qui l'a émis et que rien n'y a été changé.

**État : brouillon 0.1.** Rien ici n'est figé. Le premier format, `.hr`, est en
cours de mise en œuvre ; les autres secteurs viendront par le même chemin.

Algeria Open Standard (AOS) est une initiative d'éditeurs de logiciels. Ce n'est
pas une norme de l'État ni d'un organisme public, et il ne prétend pas l'être.

## Ce que le standard définit

| Couche | Ce qu'elle fixe | Document |
| --- | --- | --- |
| Socle | Le conteneur, les segments, les empreintes, les versions | [spec/core.md](spec/core.md) |
| Cachets | Comment un émetteur scelle ce qu'il émet, et comment les émetteurs successifs s'enchaînent | [spec/seal.md](spec/seal.md) |
| Confiance | Comment celui qui vérifie sait à qui appartient une clé, l'annuaire des clés, et ce que dit la loi | [spec/trust.md](spec/trust.md) |
| Formats | Les données d'un secteur : `.hr` aujourd'hui | [formats/](formats/) |

Un format ne redéfinit jamais le socle ni les cachets : il dit seulement quelles
parties un fichier contient et ce qu'elles veulent dire. C'est ce qui permet
d'ajouter la facturation, la comptabilité, la santé ou l'éducation sans refaire
la sécurité à chaque fois.

## Les formats

| Extension | Secteur | Version | État |
| --- | --- | --- | --- |
| [`.hr`](formats/hr/README.md) | Ressources humaines et paie : le dossier d'un salarié | 0.1 | brouillon |

La liste qui fait foi est [registry/formats.json](registry/formats.json).

## Les principes

1. **Le fichier appartient à celui dont il parle.** Un salarié emporte son
   dossier, choisit à qui il le donne, et peut le donner sans certaines parties.
2. **Chacun scelle sa part.** Un émetteur répond de ce qu'il a écrit, pas de ce
   qu'un autre a écrit avant lui. Personne ne réécrit le segment d'un autre.
3. **La clé privée ne quitte jamais son détenteur.** Chaque entreprise crée la
   sienne. L'annuaire du standard ne reçoit que des clés publiques.
4. **Vérifier ne demande la permission de personne.** Un fichier se vérifie hors
   ligne, avec des outils libres, sans compte ni abonnement.
5. **Ce qui existe déjà n'est pas réinventé.** ZIP, JSON, JSON Schema, JWS
   (RFC 7515), Ed25519 (RFC 8032), X.509 : des briques que tous les langages
   savent lire.
6. **La spécification est prouvée par du code.** Chaque règle a un test, chaque
   format a des fichiers d'exemple que toute mise en œuvre doit juger de la même
   façon.
7. **Rien que la loi ne permette.** Le standard se tient dans le cadre de la loi
   sur les services de confiance et de la loi sur les données personnelles, et
   dit ce qu'il ne garantit pas.

## Essayer

Il faut Node 22.2 ou plus récent.

```sh
cd impl/js
pnpm install
pnpm test                                   # les tests du socle, des cachets et du format .hr

node src/cli.mjs verify ../../formats/hr/examples/amine-benali-2028.hr --trust ../../formats/hr/examples/trust.json
```

L'exemple est le dossier d'un salarié fictif, scellé par une première entreprise
en 2026 puis par la suivante en 2028. La commande dit, pour chaque segment, qui
l'a scellé, si chaque partie est intacte, et si la chaîne est complète.

## Le dépôt

```
spec/            le socle, les cachets, la confiance ; spec/schema/ leurs schémas JSON
formats/hr/      le format .hr : sa spécification, ses schémas, son vocabulaire, ses exemples
formats/_template/  le point de départ d'un nouveau format
registry/        les formats, les schémas d'identifiants
impl/js/         la mise en œuvre de référence et ses tests
```

## Ajouter un format

Un nouveau format part de [formats/_template/](formats/_template/README.md) :
un identifiant, une extension, les parties qu'il définit avec leurs schémas, un
vocabulaire, des fichiers d'exemple scellés, et les tests qui les jugent. La
méthode complète de proposition, de revue et d'adoption est le prochain document
à écrire ; d'ici là, une proposition s'ouvre comme une discussion sur le dépôt.

## Ce qui n'est pas encore là

- Le chiffrement d'un fichier : un `.hr` voyage aujourd'hui en clair et doit
  être transmis par un moyen protégé.
- L'annuaire des clés publiques : décidé et décrit dans
  [spec/trust.md](spec/trust.md), pas encore en service. D'ici là, une clé se
  remet directement ou se publie sur le domaine de son détenteur.
- L'horodatage d'un cachet par un tiers.
- La méthode de contribution et la gouvernance.

## Licences

- La spécification, les schémas, les vocabulaires et les exemples (`spec/`,
  `formats/`, `registry/`, les fichiers `.md`) sont sous
  [Creative Commons Attribution 4.0](LICENSE-CC-BY-4.0) : chacun peut les
  reprendre, les traduire et les mettre en œuvre, y compris dans un logiciel
  commercial, en citant Algeria Open Standard.
- Le code (`impl/`, les programmes `build.mjs`) est sous
  [Apache 2.0](LICENSE).

Copyright des contributeurs d'Algeria Open Standard.
