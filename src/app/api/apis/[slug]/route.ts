import { NextResponse } from "next/server";
import { getApiBySlug } from "@/server/catalog";

export const dynamic = "force-dynamic";

/** GET /api/apis/:slug — full record for one listing. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const api = await getApiBySlug(slug);

  if (!api) {
    return NextResponse.json(
      { success: false, error: { code: "not_found", message: `No API with slug "${slug}".` } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: api });
}
