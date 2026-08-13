import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

let supabaseServerTraceId = 0;

export async function getSupabaseServer(request?: Request) {
  const traceId = ++supabaseServerTraceId;
  const clientLabel = `[Fetch] Supabase server client create #${traceId}`;
  const cookiesLabel = `[DB] auth/session cookies #${traceId}`;
  console.time(clientLabel);
  console.time(cookiesLabel);
  const cookieStore = await cookies();
  console.timeEnd(cookiesLabel);

  const authorization = request?.headers.get("authorization") ?? undefined;

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string): string | undefined {
          return cookieStore.get(name)?.value;
        },

        set(
          name: string,
          value: string,
          options: CookieOptions
        ): void {
          cookieStore.set({
            name,
            value,
            ...options,
          });
        },

        remove(name: string, options: CookieOptions): void {
  cookieStore.set({
    name,
    value: "",
    ...options,
    maxAge: 0,
  });
      },
      },
      ...(authorization
        ? {
            global: {
              headers: {
                Authorization: authorization,
              },
            },
          }
        : {}),
    }
  );
  console.timeEnd(clientLabel);
  return client;
}
