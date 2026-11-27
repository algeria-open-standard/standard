# AOS Confiance 0.1

État : brouillon. La technique est à valider par les adoptants, les points de
droit par un juriste.

Un cachet valide dit qu'un segment a été scellé par le détenteur d'une clé. Ce
document traite de la question qui reste : **à qui est cette clé ?**

## 1. Le cadre légal

Le texte en vigueur est la **loi n° 26-02 du 17 février 2026** fixant les règles
générales relatives aux services de confiance pour les transactions
électroniques et à l'identification électronique (Journal officiel n° 14 du
18 février 2026, page 6). Elle abroge la loi n° 15-04 du 1er février 2015
(art. 115). Ce qui suit a été lu dans le Journal officiel ; les textes
d'application n'ont pas été lus.

| Ce que dit la loi | Article |
| --- | --- |
| Le cachet électronique est créé par une personne morale, « pour garantir l'origine et l'intégrité » des données ; la signature, par une personne physique | 2 |
| Un cachet **avancé** est lié à son créateur de manière univoque, permet de l'identifier, rend détectable toute modification, et est créé avec des données que le créateur « peut, avec un niveau de confiance élevé, utiliser sous son contrôle » | 4 |
| Un cachet **qualifié** repose en plus sur un certificat qualifié et un dispositif qualifié de création | 5 |
| Seule la signature qualifiée est assimilée à la signature manuscrite | 7 |
| Le cachet qualifié bénéficie d'une présomption d'intégrité et d'exactitude de l'origine | 8 |
| Un cachet ou une signature ne peut être privé de son efficacité juridique ni refusé en justice au seul motif qu'il est électronique ou qu'il ne satisfait pas aux exigences de la loi | 16 |
| La prestation de services de confiance dans le domaine économique est soumise à une autorisation de l'autorité, délivrée par service, avec un cahier des charges | 33 |
| Fournir au public des services de confiance sans autorisation est puni d'un à trois ans d'emprisonnement et d'une amende d'un à cinq millions de dinars | 104 |

La loi range parmi les services de confiance « les méthodes de création et de
gestion » du cachet électronique et de l'horodatage électronique (art. 2, 14°),
et appelle certificat de cachet électronique le « document électronique qui
associe les données de validation d'un cachet électronique au créateur du
cachet et confirme sa dénomination » (art. 2, 4°).

### Ce que cela impose au standard

1. **Un cachet AOS vise le niveau avancé de l'article 4.** Il est recevable
   comme preuve (art. 16). Il n'a pas la présomption de l'article 8, réservée
   au cachet qualifié.
2. **Le standard doit pouvoir porter un cachet qualifié.** C'est le rôle du
   paramètre `x5c` et de l'algorithme `ES256` ([seal.md](seal.md), 3) : une
   entreprise qui détient un certificat d'un prestataire autorisé scelle avec,
   et son cachet a alors toute la force que la loi lui donne.
3. **L'annuaire des clés doit être situé par rapport à cette loi avant
   d'ouvrir.** Il ne crée aucune clé. Mais il valide des entreprises et publie
   le lien entre chacune et sa clé, ce qui est proche de ce que la loi appelle
   un certificat de cachet. Savoir si le tenir demande l'autorisation de
   l'article 33 est une question de droit que ce document ne tranche pas : elle
   est à poser à un juriste et à l'autorité. Le standard ne dépend pas de la
   réponse : les niveaux T1, T2 et T4 fonctionnent sans annuaire.
4. **Personne ne crée la clé d'un autre.** L'article 4 demande que le créateur
   du cachet garde ses données de création sous son contrôle. Un organisme qui
   fabriquerait les clés privées des entreprises les aurait eues entre les
   mains : aucun cachet fait avec elles ne pourrait plus prouver son origine.

## 2. Quatre façons de connaître une clé

Le standard ne dépend d'aucun organisme pour fonctionner. Il définit des
niveaux, du plus faible au plus fort, et le vérificateur dit toujours lequel il
a atteint.

| Niveau | D'où vient la clé | Ce que cela prouve | Organisme tiers |
| --- | --- | --- | --- |
| **T0** | Du fichier seul | L'intégrité, et que deux segments viennent du même détenteur | aucun |
| **T1** direct | Le détenteur l'a remise au vérificateur | L'origine, pour ce vérificateur | aucun |
| **T2** domaine | Le détenteur la publie sur un nom de domaine qu'il tient | L'origine, liée à ce domaine | aucun |
| **T3** annuaire | Elle est inscrite dans l'annuaire des clés | L'origine, liée à une entreprise que l'annuaire a validée | l'annuaire |
| **T4** certificat | Elle est certifiée par un prestataire de services de confiance autorisé | L'origine, avec la force que la loi donne au certificat | un prestataire autorisé |

T0, T1 et T2 n'ont besoin de personne : ils peuvent servir dès aujourd'hui. T4
dépend de l'offre des prestataires autorisés. T3 est l'annuaire des clés,
décidé et décrit à la section 5, pas encore en service.

### 2.1 T1, la remise directe

Une entreprise donne sa clé publique à celles avec qui elle échange : à la
main, par un canal déjà sûr, ou imprimée sur le certificat de travail sous la
forme de son identifiant (`kid`). Le vérificateur l'ajoute à son **magasin de
confiance**, un fichier dont il répond :

```json
{
  "keys": [
    {
      "kid": "4qe6Wy0zTEqxNYqpYDzp98xeRibXYfR_NvdCpnbyVHI",
      "jwk": { "kty": "OKP", "crv": "Ed25519", "x": "…" },
      "holder": { "name": "SARL Atlas Conseil", "country": "DZ", "identifiers": [{ "scheme": "dz:nif", "value": "…" }] },
      "source": "direct",
      "validFrom": "2026-01-01T00:00:00Z",
      "validUntil": "2028-01-01T00:00:00Z"
    }
  ]
}
```

Une clé est crue si elle appartient à l'émetteur que le segment nomme (un
identifiant commun, aucun en conflit) et si la date du segment tombe dans sa
validité, avant sa révocation.

### 2.2 T2, la publication sur un domaine

Le détenteur publie ses clés à une adresse fixe de son domaine :

```
https://<domaine>/.well-known/aos/keys.json
```

Le fichier a la forme du magasin de confiance : toutes les clés, présentes et
passées, avec leur validité et leur révocation. Le segment nomme le domaine
parmi les identifiants de son émetteur (`{ "scheme": "domain", "value": "…" }`).

Ce niveau lie la clé à un nom de domaine, pas à une identité légale : il vaut ce
que vaut la certitude que ce domaine est bien celui de l'entreprise. Il ne
résiste pas à la perte du domaine, et une clé publiée aujourd'hui ne prouve pas
qu'elle l'était hier : un vérificateur DEVRAIT garder la copie de ce qu'il a lu,
avec la date.

Le protocole exact (mise en cache, changement de clé, redirections refusées)
reste à écrire.

### 2.3 T4, le certificat d'un prestataire autorisé

Le cachet porte la chaîne de certificats (`x5c`). Le vérificateur la valide
jusqu'à une racine de la liste de confiance que publie l'autorité (loi n° 26-02,
art. 2, 21°), contrôle la révocation, et rapproche le titulaire du certificat de
l'émetteur du segment. La mise en œuvre de référence transporte `x5c` et ne le
valide pas encore.

## 3. La vie d'une clé

Quelle que soit la source, une clé a une histoire, et cette histoire ne
s'efface pas :

| Événement | Ce qui est publié |
| --- | --- |
| Création | La clé, son détenteur, le début de sa validité |
| Remplacement | La nouvelle clé ; l'ancienne reçoit une fin de validité et reste publiée |
| Révocation | La date à partir de laquelle la clé ne doit plus être crue, et le motif (compromission, cessation, erreur) |

Un cachet antérieur à une révocation reste valable **si sa date est prouvée**
([seal.md](seal.md), 6). Sans preuve de date, le vérificateur le dit.

## 4. Les données personnelles

Un fichier AOS peut contenir des données personnelles, et un `.hr` n'est que
cela. La loi n° 18-07 du 10 juin 2018 s'applique à qui l'émet et à qui le
reçoit. Le standard y répond par construction :

- le fichier est remis à la personne dont il parle, qui décide à qui le
  donner ;
- elle peut retenir des parties ([core.md](core.md), 3.4) : un nouvel employeur
  n'a pas à voir un historique de salaires pour vérifier une carrière ;
- un format ne définit pas de partie pour des données sensibles sans raison
  écrite : `.hr` 0.1 ne porte ni donnée de santé, ni sanction, ni casier ;
- l'annuaire ne reçoit jamais de donnée personnelle ni de fichier : il ne
  contient que des entreprises et leurs clés publiques.

Ce qui reste à la charge de chacun : le fondement sur lequel un employeur
conserve un dossier reçu, la durée pendant laquelle il le garde, la protection
du fichier pendant son transport (il est en clair en 0.1), et les règles du
transfert hors du territoire national.

## 5. L'annuaire des clés

L'organisation du standard tient **un annuaire public des clés publiques** des
entreprises adoptantes. Chaque entreprise crée ses clés chez elle et y dépose
ses clés publiques. L'annuaire sert à une chose : qu'un vérificateur
reconnaisse le cachet d'une entreprise qu'il n'a jamais rencontrée, **même si
les serveurs de cette entreprise sont arrêtés, même si elle a fermé.**

État : décidé, spécifié ici à grands traits, pas encore en service.

### 5.1 Ce qu'il fait, et ce qu'il ne fait jamais

| Il fait | Il ne fait jamais |
| --- | --- |
| Ouvrir un compte à une entreprise et le valider | Créer, recevoir ou garder une clé privée |
| Recevoir les clés publiques qu'elle dépose | Sceller à la place d'une entreprise |
| Publier l'histoire de chaque clé, pour toujours | Effacer une clé, même celle d'une entreprise disparue |
| Répondre à tous, sans compte, à la question « à qui est cette clé ? » | Voir un fichier ou une donnée personnelle |

### 5.2 L'inscription et le dépôt

1. L'entreprise ouvre un compte et donne ses identifiants (registre du
   commerce, identification fiscale).
2. L'annuaire valide le compte. Il publie le **degré** de cette validation,
   pour que chacun sache ce qu'elle vaut : déclaré, vérifié sur pièces, vérifié
   en présence du représentant légal.
3. L'entreprise crée sa paire de clés chez elle et dépose la clé publique.
4. Elle prouve qu'elle détient la clé privée correspondante en signant un défi
   que l'annuaire lui donne. Sans cette preuve, n'importe qui pourrait déposer
   la clé d'un autre sous son propre nom.
5. La clé est publiée avec son détenteur, le début de sa validité et le degré
   de validation du compte.

Le compte sert ensuite à remplacer une clé et à la révoquer. Sa protection
compte autant que celle de la clé : qui prend le compte peut déposer une clé à
la place de l'entreprise. Il DOIT être protégé par une authentification à deux
facteurs, et tout dépôt DOIT être notifié aux contacts de l'entreprise.

### 5.3 Toujours disponible

L'annuaire ne doit jamais être le point qui empêche de vérifier. Il est donc
publié sous une forme que n'importe qui peut copier :

- chaque entrée est un petit fichier statique, servi en HTTPS, sans calcul à la
  demande ;
- l'annuaire entier se télécharge en un fichier (un instantané), que le
  vérificateur garde et utilise hors ligne ;
- il est recopié en continu dans un dépôt public, où son histoire se lit ligne
  par ligne ;
- des miroirs tenus par d'autres que l'organisation sont permis et souhaités.

Une clé inscrite y reste après la fermeture de l'entreprise, avec la date de
cette fermeture : un cachet apposé avant reste vérifiable.

### 5.4 Ce qu'on y lit

Adresses de lecture, ouvertes à tous (protocole à préciser) :

```
GET /keys/<kid>.json                     une clé, par son identifiant
GET /organisations/<schéma>/<valeur>.json   les clés d'une entreprise, par un de ses identifiants
GET /snapshot.json                       tout l'annuaire
```

Une entrée a la forme d'une entrée du magasin de confiance (2.1), avec en plus
la date d'inscription et le degré de validation :

```json
{
  "kid": "4qe6Wy0zTEqxNYqpYDzp98xeRibXYfR_NvdCpnbyVHI",
  "jwk": { "kty": "OKP", "crv": "Ed25519", "x": "…" },
  "holder": { "name": "SARL Atlas Conseil", "country": "DZ", "identifiers": [{ "scheme": "dz:nif", "value": "…" }] },
  "source": "registry",
  "verification": "documents",
  "registeredAt": "2027-01-10T09:00:00Z",
  "validFrom": "2027-01-10T09:00:00Z",
  "validUntil": null,
  "revokedAt": null
}
```

### 5.5 Pourquoi le croire

Un annuaire est une cible : qui le contrôle peut faire passer la clé d'un
faussaire pour celle d'une entreprise. Trois protections, de la plus simple à
la plus forte :

1. **Chaque entrée et chaque instantané portent le cachet de l'annuaire**, fait
   comme tous les cachets du standard. Un miroir ne peut rien y changer.
2. **L'histoire est publique.** Une entreprise surveille ses propres entrées et
   voit aussitôt une clé inscrite à son nom sans elle ; les miroirs voient une
   entrée qui change ou disparaît.
3. **À terme, un journal que personne ne peut réécrire**, sur le modèle de
   Certificate Transparency (RFC 6962, RFC 9162) : chaque opération entre dans
   un arbre de Merkle dont l'annuaire signe la tête, chaque réponse vient avec
   la preuve qu'elle y figure, et des tiers vérifient que le journal n'a fait
   que grandir. Un annuaire qui montrerait deux histoires à deux personnes
   serait pris sur le fait. Le même journal pourra dater un cachet
   ([seal.md](seal.md), 6).

Les deux premières sont à mettre en place dès l'ouverture. La troisième est la
cible ; tant qu'elle n'est pas là, l'annuaire est cru sur parole et sur
surveillance, et ce document le dit.

### 5.6 Les clés de l'annuaire lui-même

Tenues dans un module matériel, utilisées sous le contrôle de plusieurs
personnes, avec une clé racine hors ligne qui ne sert qu'à désigner les clés de
service. La clé publique de l'annuaire est distribuée avec les outils du
standard. Son renouvellement et sa compromission sont prévus et publiés avant
l'ouverture.

### 5.7 Un annuaire, pas un passage obligé

Le vérificateur choisit ce à quoi il se fie. L'annuaire de l'organisation est
celui que les outils du standard connaissent par défaut ; rien n'empêche une
profession ou un groupe d'entreprises de tenir le sien selon les mêmes règles,
et un fichier reste vérifiable sans aucun annuaire aux niveaux T1 et T2.

## 6. L'organisation

L'organisation du standard a deux activités, qu'elle tient séparées :

| Activité | Ce qu'elle fait | Ce qu'il lui faut |
| --- | --- | --- |
| **Le standard** | Écrit les spécifications, tient les formats, publie les outils et les exemples | Un dépôt public, une méthode de décision, des adoptants |
| **L'annuaire** | Valide les comptes, publie les clés | Une personne morale, une politique publiée (qui est validé, comment, par qui), un journal de ses actes, des audits, et le statut que la loi exige, s'il en faut un (section 1, point 3) |

Publier une spécification n'engage que son texte. Tenir l'annuaire engage
envers tous ceux qui s'y fient : c'est pourquoi sa politique et ses comptes
rendus sont publics, et pourquoi ceux qui valident les comptes ne sont pas ceux
qui décident des formats.

## 7. Ce qui reste ouvert

- La situation de l'annuaire au regard de la loi n° 26-02 (section 1, point 3).
- Le protocole de l'annuaire : dépôt, défi, remplacement, révocation, instantané.
- Les textes d'application de la loi n° 26-02, non lus.
- Le protocole de publication sur un domaine (2.2).
- La validation de `x5c` (2.3) et le contenu des preuves de date.
- La forme des numéros d'identification (NIF, NIS, registre du commerce), que
  0.1 ne contrôle pas.
