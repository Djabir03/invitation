# Projet : application de cartes d'invitation animées

## Concept
Application où chacun crée et personnalise une carte d'invitation, puis l'envoie à ses invités.
Chaque invité reçoit la carte dans une enveloppe : au clic, l'enveloppe s'ouvre et la carte
sort avec une animation.

Trois temps : **Créer**, **Envoyer**, **Révéler**.

Deux profils : l'**organisateur** (crée et envoie) et l'**invité** (reçoit, ouvre, répond).

## Décisions prises
- Démarrer par des **modèles modifiables** (au moins 10), pas par un canevas libre façon Figma/Adobe.
- Chaque modèle a des zones modifiables : titre, date, lieu, message, couleurs, police, 1 à 3 emplacements photo.
- **Cartes de mariage** : la photo sert de fond d'écran à toute la carte.
- Deux idées de différenciation retenues : enveloppe personnalisée par invité et RSVP intégré.
- Un seul canal d'envoi au départ : un lien unique par invité, partageable sur WhatsApp.

## Les 10 modèles
1. Mariage classique (ivoire et or, police à empattements)
2. Mariage floral (fleurs aquarelle, tons doux)
3. Anniversaire enfant (couleurs vives, ballons)
4. Anniversaire adulte (fond sombre, détails dorés)
5. Baptême / naissance (pastels, étoiles ou nuages)
6. Cérémonie traditionnelle (motifs wax ou pagne, couleurs chaudes)
7. Soirée / fête (néons, fort contraste)
8. Événement d'entreprise (bleu et blanc, mise en page structurée)
9. Remise de diplôme (style académique, bordure fine)
10. Fêtes de fin d'année (rouge, vert et or)

## Règles des cartes de mariage (photo en fond)
1. Emplacement « photo de fond » obligatoire, sur toute la carte.
2. Calque de couleur semi-transparent entre la photo et le texte, opacité réglable.
3. Recadrage et zoom avec aperçu aux proportions exactes de la carte.
4. Résolution minimale de 1200 px de large, avertissement si trop petite.
5. Compression et redimensionnement à l'import.
6. La photo de fond se charge avant l'ouverture de l'enveloppe.

## Idées de différenciation
### 1. Enveloppe personnalisée par invité
- Lien unique par invité, code aléatoire de 16 caractères ou plus (jamais un numéro incrémenté).
- Le nom de l'invité s'affiche sur l'enveloppe (« Pour Awa et sa famille »).
- Bouton « Envoyer sur WhatsApp » par invité, message et lien déjà remplis.
- Invité groupé possible (« Famille Koné ») avec un nombre de places.

### 2. Réponse intégrée (RSVP)
- Boutons « Je viens » / « Je ne viens pas », nombre de personnes facultatif.
- Réponse toujours enregistrée en base.
- Tableau de bord : confirmés, refus, sans réponse.
- Date limite de réponse, modification possible jusque-là.
- L'organisateur peut marquer à la main le statut d'un invité.

## Données minimales
- **Cartes** : modèle, textes, couleurs, photo de fond, organisateur
- **Invités** : nom, code unique, nombre de places, carte liée
- **Réponses** : statut, nombre de personnes, date de réponse

La suppression d'une carte efface ses invités et leurs réponses.

## Failles et risques identifiés
1. Éditeur trop ambitieux (le plus gros risque).
2. Performance sur mobiles d'entrée de gamme.
3. Animation de l'enveloppe : chargement, compatibilité, page de secours nécessaire.
4. Livraison des invitations : canal d'envoi à clarifier.
5. Coûts cachés : stockage d'images, bande passante, SMS.
6. Vie privée : noms, contacts et photos d'invités.
7. Concurrence : Canva, Evite, Paperless Post, modèles animés WhatsApp.
8. Contenu non vérifié : risque d'abus sans modération minimale.

## Périmètre du MVP
**Dans le MVP**
- Modèles de cartes modifiables (texte, couleurs, 1 à 3 photos)
- Enveloppe animée avec ouverture au clic
- Lien unique par invité avec son nom sur l'enveloppe
- RSVP et tableau de bord simple
- Page de secours sans animation

**Hors MVP**
- Canevas libre complet
- Envoi par e-mail ou SMS
- Suivi détaillé des ouvertures, rappels automatiques
- Paiement et comptes avancés

## Recommandations techniques déjà évoquées
- Utiliser une bibliothèque de canevas existante (Fabric.js ou Konva.js), ne pas réécrire le moteur.
- Animer l'enveloppe avec CSS, Lottie ou GSAP ; tester sur un téléphone modeste dès le début.
- Vérifier la licence de chaque ressource (animations, illustrations, polices) avant de l'intégrer.
- Décider du modèle économique tôt (ex. : filigrane en gratuit, version payante sans filigrane).

## Prochaines étapes
- [ ] Choisir la pile technique (sujet de la prochaine discussion)
- [ ] Choisir l'occasion cible pour les premiers modèles
- [ ] Prototyper l'animation de l'enveloppe et la tester sur un téléphone modeste
- [ ] Montrer le prototype à 10 organisateurs potentiels
- [ ] Décider du modèle économique
