# Sécurité

Algeria Open Standard sert à prouver l'origine et l'intégrité de données. Un
défaut dans la spécification ou dans la mise en œuvre de référence touche tous
ceux qui l'adoptent.

## Signaler un défaut

Ne l'écrivez pas dans une discussion publique. Utilisez le signalement privé de
vulnérabilité du dépôt (onglet « Security »). Dites ce que vous avez trouvé,
comment le reproduire, et joignez si possible un fichier qui le montre.

Un défaut de la spécification compte autant qu'un défaut du code : une règle
ambiguë que deux mises en œuvre lisent différemment est une faille.

## Ce que le standard garantit, et ce qu'il ne garantit pas

La liste des menaces et de ce qui les arrête est dans
[spec/seal.md](spec/seal.md), section 9. Trois limites sont connues et dites :

- un fichier dont le dernier segment a été retiré reste valide ;
- sans preuve de date par un tiers, un faux antidaté avec une clé volée n'est
  pas détecté ;
- un fichier est en clair en 0.1.

## Les clés d'essai

Les clés de `formats/*/examples/keys/` sont publiées exprès. Elles ne protègent
rien. Ne les utilisez jamais pour sceller autre chose que des exemples.
