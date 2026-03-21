"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const handleCallback = async () => {
      // PKCE flow: URLの code パラメータをセッションに交換
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const redirectPath = localStorage.getItem("oauth_redirect") || "/analyze";
        localStorage.removeItem("oauth_redirect");
        router.push(redirectPath);
      } else {
        router.push("/login");
      }
    };

    handleCallback();
  }, []);

  return (
    <main className="min-h-screen bg-[#080C14] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">🤖</div>
        <p className="text-white text-sm">認証中...</p>
      </div>
    </main>
  );
}
