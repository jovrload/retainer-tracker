import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`Google returned an error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Missing code param", { status: 400 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    return new NextResponse(`Token exchange failed: ${JSON.stringify(data)}`, { status: 500 });
  }

  if (!data.refresh_token) {
    return new NextResponse(
      "No refresh token returned — Google only issues one the first time an app is authorized. " +
        "Go to https://myaccount.google.com/permissions, remove access for 'Retainer Tracker', then try this link again.",
      { status: 200 }
    );
  }

  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;">
      <h2>Success — copy this and paste it back in chat</h2>
      <textarea readonly style="width:100%;height:100px;font-family:monospace;font-size:14px;">${data.refresh_token}</textarea>
      <p>Once you've sent it, you can close this tab.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
