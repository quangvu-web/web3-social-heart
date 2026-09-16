import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMyPosts from "./tools/list-my-posts";
import createPost from "./tools/create-post";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fun-profile-mcp",
  title: "FUN Profile",
  version: "0.1.0",
  instructions:
    "Công cụ FUN Profile: đọc hồ sơ, liệt kê bài viết và đăng bài mới cho người dùng đang đăng nhập.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyPosts, createPost],
});
