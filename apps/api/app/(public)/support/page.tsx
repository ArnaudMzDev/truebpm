import { LegalPage, LegalSection } from "../legalPages";

export const metadata = {
    title: "Support | TrueBPM",
    description: "Contacter le support TrueBPM.",
};

export default function SupportPage() {
    return (
        <LegalPage
            kicker="Support"
            title="Besoin d'aide ?"
            intro="Pour une demande liée au compte, à la confidentialité, à la modération ou à un bug, contacte l'équipe TrueBPM depuis l'app."
        >
            <LegalSection title="Depuis l'application">
                Ouvre TrueBPM, va dans Profil, Paramètres, puis Support ou Feedback. Les demandes arrivent
                directement dans le dashboard admin pour traitement.
            </LegalSection>

            <LegalSection title="Demandes de données">
                Pour demander l&apos;accès, la correction ou la suppression de tes données, crée une demande support
                avec la catégorie Compte ou Légal.
            </LegalSection>

            <LegalSection title="Signalement">
                Pour signaler un abus, un contenu problématique ou un compte, utilise le support intégré avec
                la catégorie Abus. Les signalements peuvent mener à une action de modération.
            </LegalSection>
        </LegalPage>
    );
}
