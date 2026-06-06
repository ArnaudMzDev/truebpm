"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./AdminDashboard.module.css";

type Metrics = {
    totalUsers: number;
    onlineUsers: number;
    bannedUsers: number;
    privateUsers: number;
    newUsers24h: number;
    totalPosts: number;
    postsToday: number;
    totalComments: number;
    comments24h: number;
    messages24h: number;
    openSupportTickets: number;
    supportTickets24h: number;
    newFeedback: number;
    feedback24h: number;
    deletedAudit24h: number;
    bannedAudit24h: number;
};

type PresenceBucket = { label: string; count: number };

type AdminUser = {
    _id: string;
    pseudo: string;
    email: string;
    avatarUrl?: string;
    bio?: string;
    followers?: number;
    following?: number;
    notesCount?: number;
    isOnline?: boolean;
    lastSeenAt?: string;
    isPrivate?: boolean;
    messagePrivacy?: string;
    isBanned?: boolean;
    bannedUntil?: string | null;
    banReason?: string;
    createdAt?: string;
};

type AdminPost = {
    _id: string;
    type?: "post" | "repost";
    userId?: { pseudo?: string; email?: string; avatarUrl?: string; isBanned?: boolean };
    repostedBy?: { pseudo?: string; email?: string; avatarUrl?: string; isBanned?: boolean };
    repostOf?: { trackTitle?: string; artist?: string };
    trackTitle?: string;
    artist?: string;
    comment?: string;
    coverUrl?: string;
    likesCount?: number;
    repostsCount?: number;
    commentsCount?: number;
    createdAt?: string;
};

type AuditLog = {
    _id: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    createdAt?: string;
    adminId?: string;
};

type SupportTicket = {
    _id: string;
    category: "bug" | "abuse" | "account" | "legal" | "other";
    subject: string;
    message: string;
    status: "open" | "in_review" | "resolved" | "closed";
    priority: "normal" | "high" | "urgent";
    userPseudo?: string;
    userEmail?: string;
    userId?: { pseudo?: string; email?: string; avatarUrl?: string; isBanned?: boolean };
    adminNote?: string;
    createdAt?: string;
    updatedAt?: string;
};

type ProductFeedback = {
    _id: string;
    area: "home" | "posting" | "search" | "profile" | "messages" | "admin" | "overall";
    sentiment: "love" | "good" | "mixed" | "frustrated";
    rating: number;
    subject: string;
    message: string;
    improvement?: string;
    contactAllowed?: boolean;
    status: "new" | "reviewed" | "planned" | "done" | "archived";
    priority: "normal" | "high";
    userPseudo?: string;
    userEmail?: string;
    userId?: { pseudo?: string; email?: string; avatarUrl?: string; isBanned?: boolean };
    adminNote?: string;
    createdAt?: string;
    updatedAt?: string;
};

const metricLabels: Array<[keyof Metrics, string]> = [
    ["totalUsers", "Utilisateurs"],
    ["onlineUsers", "En ligne"],
    ["bannedUsers", "Bannis"],
    ["newUsers24h", "Nouveaux 24h"],
    ["totalPosts", "Posts"],
    ["postsToday", "Posts aujourd'hui"],
    ["comments24h", "Com. 24h"],
    ["openSupportTickets", "Support ouvert"],
    ["supportTickets24h", "Support 24h"],
    ["newFeedback", "Feedback actif"],
    ["feedback24h", "Feedback 24h"],
    ["messages24h", "Messages 24h"],
];

const supportCategoryLabels: Record<SupportTicket["category"], string> = {
    bug: "Bug",
    abuse: "Abus",
    account: "Compte",
    legal: "Légal",
    other: "Autre",
};

const supportStatusLabels: Record<SupportTicket["status"], string> = {
    open: "Ouvert",
    in_review: "En cours",
    resolved: "Résolu",
    closed: "Fermé",
};

const feedbackAreaLabels: Record<ProductFeedback["area"], string> = {
    home: "Accueil",
    posting: "Création",
    search: "Recherche",
    profile: "Profil",
    messages: "Messages",
    admin: "Admin",
    overall: "Global",
};

const feedbackSentimentLabels: Record<ProductFeedback["sentiment"], string> = {
    love: "J'adore",
    good: "Bien",
    mixed: "Mitigé",
    frustrated: "Frustré",
};

const feedbackStatusLabels: Record<ProductFeedback["status"], string> = {
    new: "Nouveau",
    reviewed: "Vu",
    planned: "Planifié",
    done: "Fait",
    archived: "Archivé",
};

function formatDate(value?: string | null) {
    if (!value) return "Permanent";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Permanent";
    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function initials(value?: string) {
    return (value || "?").slice(0, 2).toUpperCase();
}

async function readJson(res: Response) {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export default function AdminDashboard() {
    const [csrfToken, setCsrfToken] = useState("");
    const [loading, setLoading] = useState(true);
    const [loginPassword, setLoginPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [activeView, setActiveView] = useState<"overview" | "users" | "posts" | "support" | "feedback" | "audit">("overview");
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [presenceBuckets, setPresenceBuckets] = useState<PresenceBucket[]>([]);
    const [recentAudit, setRecentAudit] = useState<AuditLog[]>([]);
    const [audit, setAudit] = useState<AuditLog[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [posts, setPosts] = useState<AdminPost[]>([]);
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [feedback, setFeedback] = useState<ProductFeedback[]>([]);
    const [userQuery, setUserQuery] = useState("");
    const [userStatus, setUserStatus] = useState("all");
    const [postQuery, setPostQuery] = useState("");
    const [postType, setPostType] = useState("all");
    const [supportQuery, setSupportQuery] = useState("");
    const [supportStatus, setSupportStatus] = useState("active");
    const [feedbackQuery, setFeedbackQuery] = useState("");
    const [feedbackStatus, setFeedbackStatus] = useState("active");
    const [feedbackArea, setFeedbackArea] = useState("all");
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [banReason, setBanReason] = useState("");
    const [banUntil, setBanUntil] = useState("");
    const [selectedDeleteUser, setSelectedDeleteUser] = useState<AdminUser | null>(null);
    const [deleteUserReason, setDeleteUserReason] = useState("");
    const [deleteUserConfirmation, setDeleteUserConfirmation] = useState("");
    const [selectedPost, setSelectedPost] = useState<AdminPost | null>(null);
    const [deleteReason, setDeleteReason] = useState("");
    const [selectedSupport, setSelectedSupport] = useState<SupportTicket | null>(null);
    const [supportAdminNote, setSupportAdminNote] = useState("");
    const [supportPriority, setSupportPriority] = useState<SupportTicket["priority"]>("normal");
    const [supportNextStatus, setSupportNextStatus] = useState<SupportTicket["status"]>("in_review");
    const [selectedFeedback, setSelectedFeedback] = useState<ProductFeedback | null>(null);
    const [feedbackAdminNote, setFeedbackAdminNote] = useState("");
    const [feedbackPriority, setFeedbackPriority] = useState<ProductFeedback["priority"]>("normal");
    const [feedbackNextStatus, setFeedbackNextStatus] = useState<ProductFeedback["status"]>("reviewed");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    const maxPresence = useMemo(
        () => Math.max(1, ...presenceBuckets.map((bucket) => bucket.count)),
        [presenceBuckets]
    );

    async function refreshSessionToken() {
        const res = await fetch("/api/admin/session", { credentials: "same-origin" });
        const data = await readJson(res);

        if (res.ok && data?.authenticated && data?.csrfToken) {
            setCsrfToken(data.csrfToken);
            return data.csrfToken as string;
        }

        setCsrfToken("");
        return "";
    }

    async function api(path: string, init: RequestInit = {}) {
        const method = (init.method || "GET").toUpperCase();
        const needsCsrf = method !== "GET" && method !== "HEAD";

        const buildHeaders = (token: string) => {
            const headers = new Headers(init.headers);
            if (needsCsrf) headers.set("x-admin-csrf", token);
            return headers;
        };

        const request = (token: string) => fetch(path, {
            ...init,
            method,
            headers: buildHeaders(token),
            credentials: "same-origin",
        });

        let res = await request(csrfToken);
        let data = await readJson(res);

        if (!res.ok && needsCsrf && res.status === 403) {
            const freshToken = await refreshSessionToken();
            if (freshToken && freshToken !== csrfToken) {
                res = await request(freshToken);
                data = await readJson(res);
            }
        }

        if (!res.ok) throw new Error(data?.error || "Action admin impossible.");
        return data;
    }

    async function loadOverview() {
        const data = await api("/api/admin/overview");
        setMetrics(data.metrics);
        setPresenceBuckets(data.presenceBuckets || []);
        setRecentAudit(data.recentAudit || []);
    }

    async function loadUsers() {
        const params = new URLSearchParams();
        if (userQuery.trim()) params.set("q", userQuery.trim());
        params.set("status", userStatus);
        const data = await api(`/api/admin/users?${params.toString()}`);
        setUsers(data.users || []);
    }

    async function loadPosts() {
        const params = new URLSearchParams();
        if (postQuery.trim()) params.set("q", postQuery.trim());
        params.set("type", postType);
        const data = await api(`/api/admin/posts?${params.toString()}`);
        setPosts(data.posts || []);
    }

    async function loadSupport() {
        const params = new URLSearchParams();
        if (supportQuery.trim()) params.set("q", supportQuery.trim());
        params.set("status", supportStatus);
        const data = await api(`/api/admin/support?${params.toString()}`);
        setSupportTickets(data.tickets || []);
    }

    async function loadFeedback() {
        const params = new URLSearchParams();
        if (feedbackQuery.trim()) params.set("q", feedbackQuery.trim());
        params.set("status", feedbackStatus);
        params.set("area", feedbackArea);
        const data = await api(`/api/admin/feedback?${params.toString()}`);
        setFeedback(data.feedback || []);
    }

    async function loadAudit() {
        const data = await api("/api/admin/audit");
        setAudit(data.audit || []);
    }

    async function loadEverything() {
        await Promise.all([loadOverview(), loadUsers(), loadPosts(), loadSupport(), loadFeedback(), loadAudit()]);
    }

    useEffect(() => {
        let mounted = true;
        fetch("/api/admin/session", { credentials: "same-origin" })
            .then(readJson)
            .then((data) => {
                if (!mounted) return;
                if (data?.authenticated && data?.csrfToken) {
                    setCsrfToken(data.csrfToken);
                    return Promise.resolve().then(loadEverything);
                }
                return null;
            })
            .catch(() => null)
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    async function handleLogin(event: FormEvent) {
        event.preventDefault();
        setLoginError("");
        setBusy(true);
        try {
            const res = await fetch("/api/admin/auth/login", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: loginPassword }),
            });
            const data = await readJson(res);
            if (!res.ok) throw new Error(data?.error || "Accès refusé.");
            setCsrfToken(data.csrfToken);
            setLoginPassword("");
            await loadEverything();
        } catch (e: any) {
            setLoginError(e?.message || "Accès refusé.");
        } finally {
            setBusy(false);
            setLoading(false);
        }
    }

    async function logout() {
        setBusy(true);
        try {
            await api("/api/admin/auth/logout", { method: "POST" });
        } finally {
            setCsrfToken("");
            setMetrics(null);
            setBusy(false);
        }
    }

    async function banUser() {
        if (!selectedUser) return;
        setBusy(true);
        try {
            await api(`/api/admin/users/${selectedUser._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "ban",
                    reason: banReason,
                    bannedUntil: banUntil || null,
                }),
            });
            setNotice(`${selectedUser.pseudo} est suspendu.`);
            setSelectedUser(null);
            setBanReason("");
            setBanUntil("");
            await loadEverything();
        } finally {
            setBusy(false);
        }
    }

    async function unbanUser(user: AdminUser) {
        setBusy(true);
        try {
            await api(`/api/admin/users/${user._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "unban", reason: "Réactivation depuis le dashboard admin" }),
            });
            setNotice(`${user.pseudo} est réactivé.`);
            await loadEverything();
        } finally {
            setBusy(false);
        }
    }

    function openDeleteUserModal(user: AdminUser) {
        setSelectedDeleteUser(user);
        setDeleteUserReason("");
        setDeleteUserConfirmation("");
    }

    async function deleteUser() {
        if (!selectedDeleteUser) return;
        setBusy(true);
        try {
            const data = await api(`/api/admin/users/${selectedDeleteUser._id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reason: deleteUserReason,
                    confirmation: deleteUserConfirmation,
                }),
            });
            const counts = data?.counts || {};
            setNotice(
                `${selectedDeleteUser.pseudo} supprimé · ${counts.posts || 0} posts · ${counts.comments || 0} commentaires.`
            );
            setSelectedDeleteUser(null);
            setDeleteUserReason("");
            setDeleteUserConfirmation("");
            await loadEverything();
        } finally {
            setBusy(false);
        }
    }

    async function deletePost() {
        if (!selectedPost) return;
        setBusy(true);
        try {
            const params = new URLSearchParams();
            if (deleteReason.trim()) params.set("reason", deleteReason.trim());
            await api(`/api/admin/posts/${selectedPost._id}?${params.toString()}`, { method: "DELETE" });
            setNotice("Post supprimé.");
            setSelectedPost(null);
            setDeleteReason("");
            await loadEverything();
        } finally {
            setBusy(false);
        }
    }

    function openSupportModal(ticket: SupportTicket) {
        setSelectedSupport(ticket);
        setSupportAdminNote(ticket.adminNote || "");
        setSupportPriority(ticket.priority);
        setSupportNextStatus(ticket.status === "open" ? "in_review" : ticket.status);
    }

    async function updateSupportTicket() {
        if (!selectedSupport) return;
        setBusy(true);
        try {
            await api(`/api/admin/support/${selectedSupport._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: supportNextStatus,
                    priority: supportPriority,
                    adminNote: supportAdminNote,
                }),
            });
            setNotice("Demande support mise à jour.");
            setSelectedSupport(null);
            setSupportAdminNote("");
            await Promise.all([loadOverview(), loadSupport(), loadAudit()]);
        } finally {
            setBusy(false);
        }
    }

    function openFeedbackModal(item: ProductFeedback) {
        setSelectedFeedback(item);
        setFeedbackAdminNote(item.adminNote || "");
        setFeedbackPriority(item.priority);
        setFeedbackNextStatus(item.status === "new" ? "reviewed" : item.status);
    }

    async function updateFeedback() {
        if (!selectedFeedback) return;
        setBusy(true);
        try {
            await api(`/api/admin/feedback/${selectedFeedback._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: feedbackNextStatus,
                    priority: feedbackPriority,
                    adminNote: feedbackAdminNote,
                }),
            });
            setNotice("Feedback mis à jour.");
            setSelectedFeedback(null);
            setFeedbackAdminNote("");
            await Promise.all([loadOverview(), loadFeedback(), loadAudit()]);
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return <main className={styles.centered}>Chargement admin...</main>;
    }

    if (!csrfToken) {
        return (
            <main className={styles.loginShell}>
                <form className={styles.loginPanel} onSubmit={handleLogin}>
                    <div>
                        <p className={styles.kicker}>TrueBPM Admin</p>
                        <h1>Console de modération</h1>
                        <p className={styles.muted}>Accès réservé. Session courte, cookie sécurisé et CSRF actif.</p>
                    </div>
                    <label className={styles.field}>
                        <span>Secret admin</span>
                        <input
                            type="password"
                            value={loginPassword}
                            onChange={(event) => setLoginPassword(event.target.value)}
                            autoComplete="current-password"
                            autoFocus
                        />
                    </label>
                    {loginError && <p className={styles.error}>{loginError}</p>}
                    <button className={styles.primaryButton} disabled={busy || !loginPassword.trim()}>
                        Entrer
                    </button>
                </form>
            </main>
        );
    }

    return (
        <main className={styles.shell}>
            <aside className={styles.sidebar}>
                <div>
                    <p className={styles.kicker}>TrueBPM</p>
                    <h1>Admin</h1>
                </div>
                <nav className={styles.nav}>
                    {(["overview", "users", "posts", "support", "feedback", "audit"] as const).map((view) => (
                        <button
                            key={view}
                            className={activeView === view ? styles.navActive : ""}
                            onClick={() => setActiveView(view)}
                        >
                            {view === "overview" ? "Vue globale" : view === "users" ? "Utilisateurs" : view === "posts" ? "Posts" : view === "support" ? "Support" : view === "feedback" ? "Feedback" : "Audit"}
                        </button>
                    ))}
                </nav>
                <button className={styles.secondaryButton} disabled={busy} onClick={logout}>
                    Déconnexion
                </button>
            </aside>

            <section className={styles.content}>
                <header className={styles.topbar}>
                    <div>
                        <p className={styles.kicker}>Modération</p>
                        <h2>{activeView === "overview" ? "Santé de la plateforme" : activeView === "users" ? "Gestion utilisateurs" : activeView === "posts" ? "Gestion posts" : activeView === "support" ? "Demandes support" : activeView === "feedback" ? "Feedback produit" : "Journal admin"}</h2>
                    </div>
                    <div className={styles.actions}>
                        {notice && <span className={styles.notice}>{notice}</span>}
                        <button className={styles.primaryButton} disabled={busy} onClick={loadEverything}>
                            Rafraîchir
                        </button>
                    </div>
                </header>

                {activeView === "overview" && metrics && (
                    <div className={styles.stack}>
                        <section className={styles.metricsGrid}>
                            {metricLabels.map(([key, label]) => (
                                <article className={styles.metric} key={key}>
                                    <span>{label}</span>
                                    <strong>{metrics[key].toLocaleString("fr-FR")}</strong>
                                </article>
                            ))}
                        </section>

                        <section className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h3>Présence sur 12h</h3>
                                <span>{metrics.onlineUsers} en ligne maintenant</span>
                            </div>
                            <div className={styles.chart}>
                                {presenceBuckets.map((bucket) => (
                                    <div className={styles.barSlot} key={bucket.label}>
                                        <div
                                            className={styles.bar}
                                            style={{ height: `${Math.max(8, (bucket.count / maxPresence) * 100)}%` }}
                                            title={`${bucket.count} actifs`}
                                        />
                                        <span>{bucket.label}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h3>Dernières actions</h3>
                                <span>{metrics.deletedAudit24h} suppressions 24h</span>
                            </div>
                            <AuditTable audit={recentAudit} />
                        </section>
                    </div>
                )}

                {activeView === "users" && (
                    <section className={styles.panel}>
                        <div className={styles.filters}>
                            <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Pseudo, email, bio" />
                            <select value={userStatus} onChange={(event) => setUserStatus(event.target.value)}>
                                <option value="all">Tous</option>
                                <option value="online">En ligne</option>
                                <option value="banned">Bannis</option>
                                <option value="private">Privés</option>
                            </select>
                            <button className={styles.primaryButton} onClick={loadUsers}>Rechercher</button>
                        </div>
                        <div className={styles.rows}>
                            {users.map((user) => (
                                <article className={styles.userRow} key={user._id}>
                                    <div className={styles.avatar}>{initials(user.pseudo)}</div>
                                    <div className={styles.rowMain}>
                                        <strong>{user.pseudo}</strong>
                                        <span>{user.email}</span>
                                        <small>{user.followers || 0} followers · {user.notesCount || 0} notes · {formatDate(user.createdAt)}</small>
                                    </div>
                                    <div className={styles.badges}>
                                        {user.isOnline && <span className={styles.goodBadge}>online</span>}
                                        {user.isPrivate && <span>privé</span>}
                                        {user.isBanned && <span className={styles.dangerBadge}>banni</span>}
                                    </div>
                                    <div className={styles.rowActions}>
                                        {user.isBanned ? (
                                            <button className={styles.secondaryButton} disabled={busy} onClick={() => unbanUser(user)}>Unban</button>
                                        ) : (
                                            <button className={styles.dangerButton} disabled={busy} onClick={() => setSelectedUser(user)}>Ban</button>
                                        )}
                                        <button className={styles.dangerGhostButton} disabled={busy} onClick={() => openDeleteUserModal(user)}>
                                            Supprimer
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                {activeView === "posts" && (
                    <section className={styles.panel}>
                        <div className={styles.filters}>
                            <input value={postQuery} onChange={(event) => setPostQuery(event.target.value)} placeholder="Titre, artiste, commentaire" />
                            <select value={postType} onChange={(event) => setPostType(event.target.value)}>
                                <option value="all">Tous</option>
                                <option value="post">Posts</option>
                                <option value="repost">Reposts</option>
                            </select>
                            <button className={styles.primaryButton} onClick={loadPosts}>Rechercher</button>
                        </div>
                        <div className={styles.rows}>
                            {posts.map((post) => {
                                const title = post.type === "repost" ? post.repostOf?.trackTitle : post.trackTitle;
                                const artist = post.type === "repost" ? post.repostOf?.artist : post.artist;
                                const author = post.type === "repost" ? post.repostedBy || post.userId : post.userId;
                                return (
                                    <article className={styles.postRow} key={post._id}>
                                        <div className={styles.cover}>
                                            {post.coverUrl ? <img src={post.coverUrl} alt="" /> : initials(title)}
                                        </div>
                                        <div className={styles.rowMain}>
                                            <strong>{title || "Post sans titre"}</strong>
                                            <span>{artist || "Artiste inconnu"} · par {author?.pseudo || "Utilisateur supprimé"}</span>
                                            <small>{post.likesCount || 0} likes · {post.commentsCount || 0} com. · {formatDate(post.createdAt)}</small>
                                            {post.comment && <p>{post.comment}</p>}
                                        </div>
                                        <div className={styles.badges}>
                                            <span>{post.type || "post"}</span>
                                            {author?.isBanned && <span className={styles.dangerBadge}>auteur banni</span>}
                                        </div>
                                        <button className={styles.dangerButton} disabled={busy} onClick={() => setSelectedPost(post)}>
                                            Supprimer
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}

                {activeView === "support" && (
                    <section className={styles.panel}>
                        <div className={styles.filters}>
                            <input value={supportQuery} onChange={(event) => setSupportQuery(event.target.value)} placeholder="Sujet, message, pseudo, email" />
                            <select value={supportStatus} onChange={(event) => setSupportStatus(event.target.value)}>
                                <option value="active">Actives</option>
                                <option value="open">Ouvertes</option>
                                <option value="in_review">En cours</option>
                                <option value="resolved">Résolues</option>
                                <option value="closed">Fermées</option>
                                <option value="all">Toutes</option>
                            </select>
                            <button className={styles.primaryButton} onClick={loadSupport}>Rechercher</button>
                        </div>

                        <div className={styles.rows}>
                            {supportTickets.map((ticket) => {
                                const user = ticket.userId;
                                return (
                                    <article className={styles.supportRow} key={ticket._id}>
                                        <div className={styles.rowMain}>
                                            <strong>{ticket.subject}</strong>
                                            <span>{user?.pseudo || ticket.userPseudo || "Utilisateur"} · {user?.email || ticket.userEmail || "email inconnu"}</span>
                                            <p className={styles.supportMessage}>{ticket.message}</p>
                                            {ticket.adminNote && <small>Note admin : {ticket.adminNote}</small>}
                                        </div>
                                        <div className={styles.badges}>
                                            <span>{supportCategoryLabels[ticket.category]}</span>
                                            <span className={ticket.priority === "urgent" || ticket.priority === "high" ? styles.dangerBadge : ""}>{ticket.priority}</span>
                                            <span className={ticket.status === "resolved" || ticket.status === "closed" ? styles.goodBadge : ""}>{supportStatusLabels[ticket.status]}</span>
                                            {user?.isBanned && <span className={styles.dangerBadge}>user banni</span>}
                                        </div>
                                        <small>{formatDate(ticket.createdAt)}</small>
                                        <button className={styles.primaryButton} disabled={busy} onClick={() => openSupportModal(ticket)}>
                                            Traiter
                                        </button>
                                    </article>
                                );
                            })}
                            {!supportTickets.length && <p className={styles.muted}>Aucune demande support pour ce filtre.</p>}
                        </div>
                    </section>
                )}

                {activeView === "feedback" && (
                    <section className={styles.panel}>
                        <div className={styles.filters}>
                            <input value={feedbackQuery} onChange={(event) => setFeedbackQuery(event.target.value)} placeholder="Sujet, avis, idée, pseudo, email" />
                            <select value={feedbackStatus} onChange={(event) => setFeedbackStatus(event.target.value)}>
                                <option value="active">Actifs</option>
                                <option value="new">Nouveaux</option>
                                <option value="reviewed">Vus</option>
                                <option value="planned">Planifiés</option>
                                <option value="done">Faits</option>
                                <option value="archived">Archivés</option>
                                <option value="all">Tous</option>
                            </select>
                            <select value={feedbackArea} onChange={(event) => setFeedbackArea(event.target.value)}>
                                <option value="all">Toutes zones</option>
                                <option value="overall">Global</option>
                                <option value="home">Accueil</option>
                                <option value="posting">Création</option>
                                <option value="search">Recherche</option>
                                <option value="profile">Profil</option>
                                <option value="messages">Messages</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button className={styles.primaryButton} onClick={loadFeedback}>Rechercher</button>
                        </div>

                        <div className={styles.rows}>
                            {feedback.map((item) => {
                                const user = item.userId;
                                return (
                                    <article className={styles.supportRow} key={item._id}>
                                        <div className={styles.rowMain}>
                                            <strong>{item.subject}</strong>
                                            <span>{user?.pseudo || item.userPseudo || "Utilisateur"} · {user?.email || item.userEmail || "email inconnu"}</span>
                                            <p className={styles.supportMessage}>{item.message}</p>
                                            {item.improvement && <small>Idée : {item.improvement}</small>}
                                            {item.adminNote && <small>Note admin : {item.adminNote}</small>}
                                        </div>
                                        <div className={styles.badges}>
                                            <span>{feedbackAreaLabels[item.area]}</span>
                                            <span>{feedbackSentimentLabels[item.sentiment]}</span>
                                            <span className={item.rating <= 2 ? styles.dangerBadge : item.rating >= 4 ? styles.goodBadge : ""}>{item.rating}/5</span>
                                            <span className={item.status === "done" ? styles.goodBadge : ""}>{feedbackStatusLabels[item.status]}</span>
                                            {item.priority === "high" && <span className={styles.dangerBadge}>high</span>}
                                        </div>
                                        <small>{formatDate(item.createdAt)}</small>
                                        <button className={styles.primaryButton} disabled={busy} onClick={() => openFeedbackModal(item)}>
                                            Traiter
                                        </button>
                                    </article>
                                );
                            })}
                            {!feedback.length && <p className={styles.muted}>Aucun feedback pour ce filtre.</p>}
                        </div>
                    </section>
                )}

                {activeView === "audit" && (
                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <h3>Journal d&apos;audit</h3>
                            <button className={styles.primaryButton} onClick={loadAudit}>Rafraîchir</button>
                        </div>
                        <AuditTable audit={audit} />
                    </section>
                )}
            </section>

            {selectedUser && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <h3>Ban {selectedUser.pseudo}</h3>
                        <label className={styles.field}>
                            <span>Raison</span>
                            <textarea value={banReason} onChange={(event) => setBanReason(event.target.value)} maxLength={500} />
                        </label>
                        <label className={styles.field}>
                            <span>Fin optionnelle</span>
                            <input type="datetime-local" value={banUntil} onChange={(event) => setBanUntil(event.target.value)} />
                        </label>
                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => setSelectedUser(null)}>Annuler</button>
                            <button className={styles.dangerButton} disabled={busy || !banReason.trim()} onClick={banUser}>Confirmer le ban</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedDeleteUser && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <h3>Supprimer le compte</h3>
                        <p className={styles.muted}>
                            Cette action supprime définitivement {selectedDeleteUser.pseudo}, ses posts,
                            commentaires, notes, messages, follows, demandes, notifications, tickets support
                            et feedbacks.
                        </p>
                        <label className={styles.field}>
                            <span>Raison admin</span>
                            <textarea
                                value={deleteUserReason}
                                onChange={(event) => setDeleteUserReason(event.target.value)}
                                maxLength={500}
                            />
                        </label>
                        <label className={styles.field}>
                            <span>Confirmation : écris SUPPRIMER</span>
                            <input
                                value={deleteUserConfirmation}
                                onChange={(event) => setDeleteUserConfirmation(event.target.value)}
                                autoComplete="off"
                            />
                        </label>
                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => setSelectedDeleteUser(null)}>Annuler</button>
                            <button
                                className={styles.dangerButton}
                                disabled={busy || !deleteUserReason.trim() || deleteUserConfirmation !== "SUPPRIMER"}
                                onClick={deleteUser}
                            >
                                Supprimer définitivement
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPost && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <h3>Supprimer le post</h3>
                        <p className={styles.muted}>{selectedPost.trackTitle || selectedPost.repostOf?.trackTitle || selectedPost._id}</p>
                        <label className={styles.field}>
                            <span>Raison</span>
                            <textarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} maxLength={500} />
                        </label>
                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => setSelectedPost(null)}>Annuler</button>
                            <button className={styles.dangerButton} disabled={busy || !deleteReason.trim()} onClick={deletePost}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedSupport && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <h3>Traiter la demande</h3>
                        <p className={styles.muted}>{selectedSupport.subject}</p>
                        <p className={styles.supportMessage}>{selectedSupport.message}</p>

                        <label className={styles.field}>
                            <span>Statut</span>
                            <select value={supportNextStatus} onChange={(event) => setSupportNextStatus(event.target.value as SupportTicket["status"])}>
                                <option value="open">Ouvert</option>
                                <option value="in_review">En cours</option>
                                <option value="resolved">Résolu</option>
                                <option value="closed">Fermé</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span>Priorité</span>
                            <select value={supportPriority} onChange={(event) => setSupportPriority(event.target.value as SupportTicket["priority"])}>
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span>Note admin</span>
                            <textarea value={supportAdminNote} onChange={(event) => setSupportAdminNote(event.target.value)} maxLength={2000} />
                        </label>

                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => setSelectedSupport(null)}>Annuler</button>
                            <button className={styles.primaryButton} disabled={busy} onClick={updateSupportTicket}>Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedFeedback && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <h3>Traiter le feedback</h3>
                        <p className={styles.muted}>{selectedFeedback.subject} · {selectedFeedback.rating}/5</p>
                        <p className={styles.supportMessage}>{selectedFeedback.message}</p>
                        {selectedFeedback.improvement && <p className={styles.supportMessage}>Idée : {selectedFeedback.improvement}</p>}

                        <label className={styles.field}>
                            <span>Statut</span>
                            <select value={feedbackNextStatus} onChange={(event) => setFeedbackNextStatus(event.target.value as ProductFeedback["status"])}>
                                <option value="new">Nouveau</option>
                                <option value="reviewed">Vu</option>
                                <option value="planned">Planifié</option>
                                <option value="done">Fait</option>
                                <option value="archived">Archivé</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span>Priorité</span>
                            <select value={feedbackPriority} onChange={(event) => setFeedbackPriority(event.target.value as ProductFeedback["priority"])}>
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span>Note admin</span>
                            <textarea value={feedbackAdminNote} onChange={(event) => setFeedbackAdminNote(event.target.value)} maxLength={2000} />
                        </label>

                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => setSelectedFeedback(null)}>Annuler</button>
                            <button className={styles.primaryButton} disabled={busy} onClick={updateFeedback}>Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function AuditTable({ audit }: { audit: AuditLog[] }) {
    if (!audit.length) return <p className={styles.muted}>Aucune action récente.</p>;

    return (
        <div className={styles.auditTable}>
            {audit.map((item) => (
                <div className={styles.auditRow} key={item._id}>
                    <strong>{item.action}</strong>
                    <span>{item.targetType} · {item.targetId}</span>
                    <span>{item.reason || "Sans raison"}</span>
                    <time>{formatDate(item.createdAt)}</time>
                </div>
            ))}
        </div>
    );
}
