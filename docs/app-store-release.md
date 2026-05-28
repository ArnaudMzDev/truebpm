# TrueBPM App Store release

## URLs

- Privacy Policy URL: `https://truebpm.fr/privacy`
- Support URL: `https://truebpm.fr/support`
- Terms URL: `https://truebpm.fr/terms`

Les pages publiques existent côté API Next :

- `/privacy`
- `/support`
- `/terms`

## Age rating

Recommandation : `13+`.

Réponses attendues dans App Store Connect :

- User-generated content: Yes
- Messaging / chat: Yes
- Unrestricted web access: No
- Gambling: No
- Contests: No
- In-app purchases: No
- Explicit sexual content: No
- Realistic violence: No
- Profanity / crude humor: Infrequent or mild

## App Privacy

Tracking: No.

Data linked to the user:

- Contact Info > Email Address
  - email du compte, email support/feedback
  - App Functionality, Account Management, Customer Support
- User Content > Photos or Videos
  - avatar, bannière, images de messages
  - App Functionality
- User Content > Customer Support
  - tickets support, messages support
  - Customer Support
- User Content > Other User Content
  - posts, notes, commentaires, reposts, messages, bio, favoris musicaux
  - App Functionality, Product Personalization
- Identifiers > User ID
  - identifiant utilisateur interne
  - App Functionality
- Identifiers > Device ID
  - Expo push token, device name si notifications acceptées
  - App Functionality
- Usage Data > Product Interaction
  - likes, follows, messages lus, statut online, préférences feed, activité sociale
  - App Functionality, Product Personalization

Ne pas déclarer sauf changement produit :

- Location
- Contacts
- Health / Fitness
- Financial Info
- Browsing History
- Sensitive Info
- Diagnostics, sauf ajout de crash reporting ou analytics externe

## Demo account

Créer ce compte en production avant soumission :

- Email: `review@truebpm.app`
- Password: `TrueBPMReview2026!`
- Pseudo: `AppleReview`

Préparer le compte avec :

- profil rempli
- avatar et bannière
- titre épinglé
- 2 ou 3 posts
- quelques artistes favoris

Ne jamais fournir le compte admin à Apple.

## Review notes

```text
TrueBPM is a social music app where users can rate songs, albums and artists, publish music reviews, follow profiles, comment, send messages and listen to short audio previews.

A demo account is available:
Email: review@truebpm.app
Password: TrueBPMReview2026!

The app requires login to access the main social features.

ShazamKit:
The Search screen includes an “Identify a song” feature powered by Apple ShazamKit. Microphone access is requested only when the user taps the recognition button. TrueBPM does not store raw microphone audio.

Music previews:
Audio previews are used only to let users listen before rating. There are no purchases, subscriptions or paid digital content in this version.

User-generated content:
Users can publish posts, comments, profile content and messages. Moderation tools are available through the admin dashboard, and users can contact support from the app for abuse, account or legal requests.

Privacy:
The app collects account information, user-generated content, profile images, support/feedback messages, push notification tokens and app interactions needed for core functionality. The app does not use third-party tracking or advertising identifiers.
```

## Production build

La config Expo lit les variables d'environnement suivantes :

```bash
EXPO_PUBLIC_API_URL=https://api.truebpm.fr
EXPO_PUBLIC_SOCKET_URL=https://socket.truebpm.fr
```

Build iOS :

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.truebpm.fr EXPO_PUBLIC_SOCKET_URL=https://socket.truebpm.fr eas build --platform ios --profile production
```

Si le socket est servi sur le même domaine ou via le même backend, utiliser l'URL exacte exposée en production.

## Checklist finale

- Déployer l'API Next en HTTPS.
- Déployer ou exposer le socket en HTTPS/WSS.
- Vérifier `/privacy`, `/support`, `/terms` sur le domaine public.
- Créer le compte demo en production.
- Tester login, feed, recherche, ShazamKit, création de post, commentaire, message, profil, support.
- Uploader les screenshots App Store depuis `apps/mobile/store-assets/app-store/png`.
- Vérifier que `app.json` / `app.config.js` sortent bien `fr.truebpm.app`.
