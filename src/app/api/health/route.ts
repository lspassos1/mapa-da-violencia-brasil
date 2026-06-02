import { NextResponse } from "next/server";
import packageInfo from "../../../../package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: packageInfo.version,
      service: "mapa-da-violencia-brasil",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
