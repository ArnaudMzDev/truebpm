import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

export const dynamic = "force-dynamic";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(req: Request) {
    try {
        const meId = await verifyToken(req).catch(() => null);
        if (!meId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

        const form = await req.formData();
        const file = form.get("file");
        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
        }
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            return NextResponse.json({ error: "Format image non autorisé." }, { status: 415 });
        }
        if (file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: "Image trop lourde. Maximum 5 Mo." }, { status: 413 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const result = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "truebpm/messages",
                    resource_type: "image",
                    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
                    transformation: [{ quality: "auto:good", fetch_format: "auto" }],
                },
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
