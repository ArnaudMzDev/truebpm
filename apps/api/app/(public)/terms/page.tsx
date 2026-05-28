import { LegalPage, LegalSection } from "../legalPages";

export const metadata = {
    title: "Conditions d'utilisation | TrueBPM",
    description: "Conditions d'utilisation de TrueBPM.",
};

export default function TermsPage() {
    return (
        <LegalPage
            kicker="Conditions"
            title="Conditions d'utilisation"
            intro="TrueBPM est une app sociale musicale pour noter, commenter, découvrir et partager des morceaux, albums et artistes."
        >
            <LegalSection title="Compte">
                Tu dois fournir des informations exactes, garder ton compte sécurisé et ne pas utiliser
                l&apos;identité d&apos;une autre personne. Tu restes responsable de l&apos;activité réalisée depuis ton compte.
            </LegalSection>

            <LegalSection title="Contenus publiés">
                Tu conserves tes droits sur tes contenus, mais tu autorises TrueBPM à les héberger, afficher,
                modérer et partager dans l&apos;application afin de faire fonctionner le service.
            </LegalSection>

            <LegalSection title="Comportements interdits">
                Harcèlement, menaces, haine, spam, contenus illégaux, manipulation de notes, usurpation
                d&apos;identité, scraping abusif et tentative d&apos;accès non autorisé sont interdits.
            </LegalSection>

            <LegalSection title="Modération">
                TrueBPM peut retirer un contenu, limiter une fonctionnalité, suspendre ou bannir un compte
                en cas de violation des règles, de risque légal ou de protection de la communauté.
            </LegalSection>

            <LegalSection title="Service gratuit">
                TrueBPM ne propose actuellement pas d&apos;achat intégré, d&apos;abonnement payant ou de vente de biens
                numériques. Si des fonctionnalités payantes arrivent, des conditions dédiées seront ajoutées.
            </LegalSection>
        </LegalPage>
    );
}
