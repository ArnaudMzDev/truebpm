import React, { useMemo } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontWeights, radius, spacing, typography } from "../theme";

type LegalDocument = "terms" | "privacy" | "community" | "sales";

type Section = {
    title: string;
    body: string;
};

const documents: Record<LegalDocument, { title: string; subtitle: string; sections: Section[] }> = {
    terms: {
        title: "Conditions d'utilisation",
        subtitle: "Dernière mise à jour : 26 mai 2026",
        sections: [
            {
                title: "Objet",
                body: "TrueBPM est une application sociale autour de la musique. Elle permet de publier des avis, notes, commentaires, messages et contenus associés à des morceaux, albums ou artistes.",
            },
            {
                title: "Compte",
                body: "Tu dois fournir des informations exactes, garder ton compte sécurisé et ne pas utiliser l'identité d'une autre personne. Tu restes responsable de l'activité réalisée depuis ton compte.",
            },
            {
                title: "Contenus publiés",
                body: "Tu conserves tes droits sur tes contenus, mais tu autorises TrueBPM à les afficher, héberger, modérer et partager dans l'application afin de faire fonctionner le service.",
            },
            {
                title: "Comportements interdits",
                body: "Sont interdits : harcèlement, menaces, haine, spam, contenus illégaux, manipulation de votes, usurpation d'identité, scraping abusif, tentative d'accès non autorisé ou contournement de sécurité.",
            },
            {
                title: "Modération",
                body: "TrueBPM peut retirer un contenu, limiter une fonctionnalité, suspendre ou bannir un compte en cas de violation des règles, de risque légal ou de protection de la communauté.",
            },
            {
                title: "Disponibilité",
                body: "Le service peut évoluer, être interrompu temporairement ou comporter des erreurs. TrueBPM fait ses meilleurs efforts pour maintenir une expérience fiable.",
            },
        ],
    },
    privacy: {
        title: "Politique de confidentialité",
        subtitle: "Dernière mise à jour : 26 mai 2026",
        sections: [
            {
                title: "Données collectées",
                body: "Nous traitons notamment ton pseudo, email, mot de passe chiffré, profil, posts, notes, commentaires, messages, préférences, jetons push, statut en ligne et informations techniques nécessaires au service.",
            },
            {
                title: "Utilisation",
                body: "Ces données servent à créer ton compte, afficher ton profil, recommander du contenu, synchroniser les messages, sécuriser l'application, modérer les abus et améliorer TrueBPM.",
            },
            {
                title: "Messages et contenus",
                body: "Les messages, commentaires et posts sont stockés pour permettre leur affichage et leur modération. Ne partage pas d'information sensible dans l'application.",
            },
            {
                title: "Sécurité",
                body: "Les mots de passe sont hashés. Les sessions utilisent des tokens. Malgré les protections mises en place, aucun service connecté ne peut garantir un risque zéro.",
            },
            {
                title: "Tes droits",
                body: "Tu peux demander l'accès, la rectification ou la suppression de tes données. Pour une demande liée à tes données, contacte l'équipe TrueBPM via le support.",
            },
            {
                title: "Partenaires",
                body: "TrueBPM peut utiliser des services tiers pour la musique, les images, les notifications, l'hébergement et les analytics techniques nécessaires au fonctionnement.",
            },
        ],
    },
    community: {
        title: "Règles de communauté",
        subtitle: "Ce qui garde TrueBPM propre et agréable",
        sections: [
            {
                title: "Respect",
                body: "Les désaccords musicaux sont bienvenus. Les attaques personnelles, insultes ciblées, menaces, doxxing ou propos discriminatoires ne le sont pas.",
            },
            {
                title: "Avis authentiques",
                body: "Publie tes vraies opinions. Évite les campagnes coordonnées, les faux comptes, le spam et les notes destinées uniquement à manipuler une tendance.",
            },
            {
                title: "Contenus sensibles",
                body: "Ne publie pas de contenu illégal, sexuel explicite, violent gratuit, dangereux, frauduleux ou portant atteinte aux droits d'autrui.",
            },
            {
                title: "Modération graduée",
                body: "Selon la gravité, une action peut aller du retrait de contenu au bannissement définitif. Les actions de modération sont journalisées côté admin.",
            },
        ],
    },
    sales: {
        title: "CGV et mentions",
        subtitle: "Informations commerciales et responsabilité",
        sections: [
            {
                title: "Service gratuit",
                body: "TrueBPM ne propose actuellement pas d'achat intégré, d'abonnement payant ou de vente de biens numériques. Aucune condition générale de vente payante ne s'applique pour le moment.",
            },
            {
                title: "Évolution",
                body: "Si des fonctionnalités payantes sont ajoutées plus tard, des CGV dédiées, prix, conditions de paiement, rétractation et résiliation devront être affichés avant tout achat.",
            },
            {
                title: "Contact",
                body: "Pour une question légale, de confidentialité, de modération ou de support, contacte l'équipe TrueBPM depuis les paramètres de l'application.",
            },
            {
                title: "Avertissement",
                body: "Ces textes constituent une base produit. Avant publication définitive sur les stores, ils doivent être relus et adaptés par une personne compétente en droit applicable.",
            },
        ],
    },
};

export default function LegalScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const document = (route?.params?.document || "terms") as LegalDocument;
    const content = useMemo(() => documents[document] || documents.terms, [document]);

    return (
        <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.titleWrap}>
                    <Text style={styles.eyebrow}>Légal</Text>
                    <Text style={styles.title} numberOfLines={1}>{content.title}</Text>
                </View>

                <View style={styles.sideSpacer} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 28 }}
            >
                <View style={styles.hero}>
                    <Text style={styles.heroTitle}>{content.title}</Text>
                    <Text style={styles.heroSubtitle}>{content.subtitle}</Text>
                </View>

                {content.sections.map((section) => (
                    <View style={styles.section} key={section.title}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionBody}>{section.body}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: radius.lg,
        backgroundColor: colors.surface3,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    sideSpacer: {
        width: 42,
    },
    titleWrap: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: spacing.md,
    },
    eyebrow: {
        color: colors.primary,
        fontSize: typography.tiny,
        fontWeight: fontWeights.black,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: fontWeights.black,
    },
    hero: {
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    heroTitle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: fontWeights.black,
        marginBottom: 8,
    },
    heroSubtitle: {
        color: colors.textMuted,
        fontSize: typography.bodySm,
        fontWeight: fontWeights.medium,
        lineHeight: 20,
    },
    section: {
        paddingVertical: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.borderSoft,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: fontWeights.black,
        marginBottom: spacing.sm,
    },
    sectionBody: {
        color: colors.textMuted,
        fontSize: typography.body,
        lineHeight: 22,
        fontWeight: fontWeights.medium,
    },
});
