// 🔥 Mets ton IP ici
const API_URL = "http://192.168.1.146:3000";

// GET sécurisé avec token
export async function apiGet(path: string, token: string) {
    const res = await fetch(`${API_URL}${path}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    const data = await res.json();
    return { ok: res.ok, data };
}

// POST ou PATCH générique (si besoin plus tard)
export async function apiSend(path: string, token: string, body: any, method = "POST") {
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    return { ok: res.ok, data };
}