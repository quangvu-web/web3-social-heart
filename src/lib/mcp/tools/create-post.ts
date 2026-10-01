import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "create_post",
  title: "Đăng bài viết mới",
  description:
    "Tạo một bài viết mới trên FUN Profile dưới danh nghĩa người dùng đang đăng nhập.",
  inputSchema: {
    content: z
      .string()
      .trim()
      .min(1)
      .max(5000)
      .describe("Nội dung bài viết (bắt buộc, tối đa 5000 ký tự)."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async ({ content }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("posts")
      .insert({ user_id: ctx.getUserId(), content })
      .select("id, content, created_at")
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Đã đăng bài. ID: ${data?.id ?? "?"}` }],
      structuredContent: { post: data ?? null },
    };
  },
});
