import { LegalPage, LegalSection } from "../legalPages";

export const metadata = {
    title: "Politique de confidentialité | TrueBPM",
    description: "Politique de confidentialité de TrueBPM.",
};

export default function PrivacyPage() {
    return (
        <LegalPage
            kicker="Confidentialité"
            title="Politique de confidentialité"
            intro="TrueBPM collecte uniquement les données nécessaires au fonctionnement de l'app sociale musicale : compte, profil, avis, messages, support, sécurité et notifications."
        >
            <LegalSection title="Données de compte">
                Pseudo, email, mot de passe chiffré, date de création, préférences de confidentialité,
                statut en ligne et informations nécessaires à la session utilisateur.
            </LegalSection>

            <LegalSection title="Contenus utilisateur">
                Posts, notes, commentaires, reposts, messages, bio, avatar, bannière, artistes favoris,
                albums favoris, titres favoris et titre épinglé peuvent être stockés pour afficher le service,
                synchroniser les profils et permettre la modération.
            </LegalSection>

            <LegalSection title="Support et feedback">
                Les demandes support et feedback peuvent contenir ton pseudo, ton email, le sujet, le message,
                la catégorie, la priorité et les notes internes nécessaires au traitement par l&apos;équipe TrueBPM.
            </LegalSection>

            <LegalSection title="Notifications">
                Si tu les acceptes, TrueBPM stocke un jeton de notification push, la plateforme et le nom de
                l&apos;appareil afin d&apos;envoyer les notifications liées à l&apos;activité de ton compte.
            </LegalSection>

            <LegalSection title="Micro et ShazamKit">
                Le micro est utilisé uniquement quand tu appuies sur le bouton d&apos;identification d&apos;un son.
                TrueBPM ne stocke pas l&apos;audio brut capté par le micro. La reconnaissance s&apos;appuie sur Apple
                ShazamKit pour identifier le morceau.
            </LegalSection>

            <LegalSection title="Services tiers">
                TrueBPM peut utiliser des services tiers pour l&apos;hébergement, la base de données, les images,
                la recherche musicale, les extraits audio et les notifications. Ces services sont utilisés
                pour faire fonctionner l&apos;application, pas pour du suivi publicitaire.
            </LegalSection>

            <LegalSection title="Tracking publicitaire">
                TrueBPM n&apos;utilise pas d&apos;identifiant publicitaire, ne vend pas les données personnelles et ne
                suit pas les utilisateurs entre des apps ou sites tiers à des fins publicitaires.
            </LegalSection>

            <LegalSection title="Tes droits">
                Tu peux demander l&apos;accès, la rectification ou la suppression de tes données depuis le support
                de l&apos;app ou via la page support publique.
            </LegalSection>
        </LegalPage>
    );
}
