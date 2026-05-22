import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") ?? "/";

  const safeRedirect = (() => {
    if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
      return "/";
    }
    return redirectTo;
  })();

  if (!code) {
    console.error("Auth callback missing code", { url: request.url });
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback session exchange failed", {
      message: error.message,
    });
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth callback user fetch failed", {
      message: userError?.message ?? "Missing user after session exchange",
    });
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Auth callback profile bootstrap failed", {
      message: profileError.message,
      userId: user.id,
    });
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
