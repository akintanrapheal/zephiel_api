import { NextResponse } from "next/server";
import { getApi } from "@/data/apis";

/** GET /api/apis/:slug — full record for one listing. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const api = getApi(slug);

  if (!api) {
    return NextResponse.json(
      { success: false, error: { code: "not_found", message: `No API with slug "${slug}".` } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: api });
}
