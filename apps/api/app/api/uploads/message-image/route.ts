import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const form = await req.formData();
        const file = form.get("file");
        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const result = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: "truebpm/messages", resource_type: "image" },
                (err, res) => (err ? reject(err) : resolve(res))
            );
            stream.end(buffer);
        });

        return NextResponse.json(
            {
                imageUrl: result.secure_url,
                width: result.width,
                height: result.height,
                publicId: result.public_id,
            },
            { status: 200 }
        );
    } catch (e) {
        console.error("❌ POST /api/uploads/message-image error:", e);
        return NextResponse.json({ error: "Erreur interne serveur." }, { status: 500 });
    }
}