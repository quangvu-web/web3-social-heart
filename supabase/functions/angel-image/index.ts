// angel-image — endpoint để web (AngelFAB) và inline gọi tạo/sửa ảnh
// qua Angel AI gốc. Xác thực JWT user, forward user.id làm user_ref.
// verify_jwt = false ở config.toml (route tự xác thực).

import { createClient } from "npm:@supabase/supabase-js@2";
import { withUsage } from "../_shared/track-cloud-usage.ts";
import {
  generateAngelImage,
  generateAngelImageResilient,
  editAngelImage,
  AngelImageError,
  imageResultToDataUrl,
  detectImageIntent,
  angelImageUserMessage,
  classifyAngelImageError,
  classifyAngelImageError,
  pickImageMode,
} from "../_shared/angel-image.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ReqBody = {
  mode?: "generate" | "edit" | "auto";
  prompt?: string;
  image_url?: string | null;
  image_base64?: string | null;
  source?: "web" | "inline";
};

Deno.serve(withUsage("angel-image", "Angel AI · Image", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !anonKey) return json(500, { error: "Supabase env missing" });

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const prompt = (body?.prompt ?? "").toString().trim();
    if (!prompt) return json(400, { error: "Missing prompt" });
    if (prompt.length > 2000) return json(400, { error: "Prompt too long" });

    let mode: "generate" | "edit" = body?.mode === "edit" ? "edit" : "generate";
    if (body?.mode === "auto" || !body?.mode) {
      const hasImage = !!(body?.image_url || body?.image_base64);
      const intent = detectImageIntent(prompt, hasImage);
      if (!intent) {
        return json(400, { error: "no_image_intent_detected" });
      }
      mode = intent.mode;
    }

    const t0 = Date.now();
    try {
      const result = mode === "edit"
        ? await editAngelImage({
          instruction: prompt,
          imageUrl: body?.image_url ?? null,
          imageBase64: body?.image_base64 ?? null,
          userRef: userId,
        })
        : await generateAngelImageResilient({
          prompt,
          userRef: userId,
          // Chọn mode theo topic thay vì ép cứng spiritual. Prompt caller có thể
          // truyền image_mode: "spiritual" | "fast" để override, mặc định dùng pickImageMode.
          initialMode: (body as any)?.image_mode === "spiritual"
            ? "spiritual"
            : (body as any)?.image_mode === "fast"
              ? "fast"
              : pickImageMode(prompt),
        });

      const dataUrl = imageResultToDataUrl(result);
      return json(200, {
        ok: true,
        mode,
        image_url: result.image_url ?? null,
        image_base64: result.image_base64 ?? null,
        data_url: dataUrl,
        mime_type: result.mime_type,
        duration_ms: Date.now() - t0,
      });
    } catch (e) {
      if (e instanceof AngelImageError) {
        const kind = classifyAngelImageError(e);
        const userMessage = angelImageUserMessage(e);
        const httpStatus = kind === "quota_daily" || kind === "rate_limit" ? 429
          : kind === "content_blocked" || kind === "bad_prompt" ? 400
          : kind === "timeout" ? 504
          : 502;
        return json(httpStatus, {
          ok: false,
          error: e.message,
          error_kind: kind,
          user_message: userMessage,
          status: e.status,
          detail: e.detail,
        });
      }
      throw e;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[angel-image]", msg);
    return json(500, { error: msg });
  }
}));
