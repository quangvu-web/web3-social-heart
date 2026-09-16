import { useEffect } from "react";
import { useLocation, Navigate } from "react-router-dom";

import EcosystemDocs from "@/pages/EcosystemDocs";
import PlatformDocs from "@/pages/PlatformDocs";
import IntegrationDocs from "@/pages/IntegrationDocs";
import SdkRepositoryDocs from "@/pages/SdkRepositoryDocs";

const setCanonical = (href: string) => {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
};

const ensureMetaDescription = (content: string) => {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = content;
};

export default function DocsRouter() {
  const location = useLocation();

  // /docs/* fallback router (helps on hosts that don't preserve deep-link routing correctly)
  const subpath = location.pathname.replace(/^\/docs\/?/, "");
  const first = subpath.split("/").filter(Boolean)[0] ?? "";

  useEffect(() => {
    const origin = window.location.origin;

    if (first === "platform") {
      document.title = "FUN Ecosystem Platform Documentation";
      ensureMetaDescription(
        "FUN Ecosystem platform documentation: kiến trúc, auth, wallet, feed, rewards, media, admin và bảo mật."
      );
      setCanonical(`${origin}/docs/platform`);
      return;
    }

    if (first === "ecosystem") {
      document.title = "FUN Ecosystem SSO Documentation";
      ensureMetaDescription(
        "FUN Ecosystem SSO documentation: Email OTP, Wallet login, Social login và Law of Light."
      );
      setCanonical(`${origin}/docs/ecosystem`);
      return;
    }

    if (first === "integration") {
      document.title = "FUN Profile Integration Guide";
      ensureMetaDescription(
        "Hướng dẫn tích hợp FUN Profile SSO cho các platform: Fun Farm, Fun Play, Fun Planet."
      );
      setCanonical(`${origin}/docs/integration`);
      return;
    }

    if (first === "sdk-repository") {
      document.title = "SDK Repository Setup | @fun-ecosystem/sso-sdk";
      ensureMetaDescription(
        "Hướng dẫn tạo GitHub Repository cho @fun-ecosystem/sso-sdk - npm package chính thức."
      );
      setCanonical(`${origin}/docs/sdk-repository`);
      return;
    }

    document.title = "FUN Ecosystem Documentation";
    ensureMetaDescription(
      "Tài liệu FUN Ecosystem: SSO, app architecture, wallet, feed, rewards, media và admin."
    );
    setCanonical(`${origin}/docs`);
  }, [first]);

  if (first === "platform") return <PlatformDocs />;
  if (first === "ecosystem") return <EcosystemDocs />;
  if (first === "integration") return <IntegrationDocs />;
  if (first === "sdk-repository") return <SdkRepositoryDocs />;

  return <Navigate to="/docs/ecosystem" replace />;
}
