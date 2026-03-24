import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { inferReceiptImageMime } from "@/lib/receipt-image";
import { uploadReceiptImage } from "@/lib/receipt-upload";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = inferReceiptImageMime(file);

  try {
    const result = await uploadReceiptImage(buffer, mimeType);
    return NextResponse.json({ success: true, url: result.webViewLink });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
