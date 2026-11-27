# Gouvernance

Qui fait quoi dans Algeria Open Standard, et comment on entre dans chaque rôle.
Ce document décrit le fonctionnement visé et la période de démarrage qui y
mène. Le changer suit [la méthode](process/README.md), sorte E.

## 1. Les rôles

| Rôle | Ce qu'il fait | Comment on y entre |
| --- | --- | --- |
| **Contributeur** | Propose, relit, discute | En contribuant. Aucune adhésion n'est demandée |
| **Mainteneur** | Relit et fusionne dans son domaine ; conduit les revues ; tient les exemples et les tests à jour | Proposé par un mainteneur après des contributions suivies, confirmé par le comité |
| **Adoptant** | Une organisation qui met en œuvre un format, ou s'y est engagée par écrit | En s'inscrivant dans `registry/implementations.json` ou en signant une proposition |
| **Comité** | Décide des nouveaux formats et de tout ce qui touche au socle, aux cachets, à la confiance et à la méthode ; nomme les mainteneurs ; arbitre | Un siège par organisation adoptante |

Les domaines des mainteneurs : le socle et les cachets ; la confiance ; chaque
format ; la mise en œuvre de référence.

## 2. Le comité

- **Un siège, une voix par organisation**, quelle que soit sa taille. Deux
  organisations liées par le capital comptent pour une.
- Il décide par consensus. À défaut : à la majorité simple, ou des deux tiers
  pour ce que la méthode range dans la sorte E.
- Ses décisions sont écrites et publiques, avec leurs raisons. Une délibération
  qui n'a pas laissé de trace dans le dépôt n'a pas eu lieu.
- Un membre qui a un intérêt direct dans une décision le dit, et ne vote pas.
- Un siège se perd après un an sans mise en œuvre tenue à jour ni
  participation.

## 3. Le standard et l'annuaire

L'organisation tient aussi l'annuaire des clés publiques
([spec/trust.md](spec/trust.md), section 5). Les deux activités sont séparées :

- ceux qui valident les comptes de l'annuaire ne décident pas des formats, et
  inversement ;
- l'annuaire a sa propre politique publiée : qui est validé, sur quelles
  pièces, par qui, et comment une décision se conteste ;
- chaque acte de l'annuaire (validation, refus, retrait) est tracé, et un
  compte rendu en est publié à intervalle régulier ;
- le comité reçoit ce compte rendu et peut demander un audit.

Le standard ne favorise aucun adoptant dans l'annuaire, et l'annuaire ne
conditionne pas l'usage du standard : un fichier se vérifie sans lui.

## 4. La période de démarrage

Tant que le comité ne compte pas trois organisations :

- le fondateur du projet tient les rôles de mainteneur et de comité ;
- ses décisions sont marquées **provisoires** dans les propositions ;
- aucun format ne passe à l'état stable, puisqu'il y faut deux mises en œuvre
  indépendantes ;
- à l'entrée de la troisième organisation, le comité se constitue, confirme ou
  rouvre les décisions provisoires, et nomme les mainteneurs.

## 5. Ce que le projet n'est pas

Algeria Open Standard est une initiative d'éditeurs de logiciels. Ce n'est pas
un organisme public ni un organisme de normalisation, et il ne se présente pas
comme tel. Un format stable a vocation à être proposé aux organismes compétents
quand ses adoptants le jugent mûr.

## 6. Les droits

- Les contributions à la spécification sont publiées sous CC BY 4.0, celles au
  code sous Apache 2.0. Qui contribue accepte ces licences pour ce qu'il
  apporte, et atteste qu'il a le droit de l'apporter (une ligne
  `Signed-off-by` dans chaque commit, selon le Developer Certificate of
  Origin).
- Qui contribue à la spécification s'engage à ne pas faire valoir de brevet
  contre ceux qui la mettent en œuvre, pour ce que sa contribution rend
  nécessaire. La rédaction de cet engagement est à faire relire par un juriste
  avant que le comité ne se constitue.
- Le nom « Algeria Open Standard » désigne ce projet. Une mise en œuvre peut
  dire qu'elle le suit si elle passe les exemples ; elle ne peut pas se dire
  approuvée par le projet.
