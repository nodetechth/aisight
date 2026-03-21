"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const redirectPath = localStorage.getItem("oauth_redirect") || "/analyze";
        localStorage.removeItem("oauth_redirect");
        router.push(redirectPath);
      } else {
        router.push("/login");
      }
    });
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
