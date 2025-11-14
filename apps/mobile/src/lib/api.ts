const API_URL = "http://localhost:3000"; 
// ⚠️ iPhone réel → remplace par IP locale : http://192.168.X.X:3000

export async function api(path: string, options: any = {}) {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });

    const data = await res.json();
    return { ok: res.ok, data };
}
