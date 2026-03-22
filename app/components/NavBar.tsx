"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#080C14]/90 backdrop-blur border-b border-white/5">
      <a href="/" className="text-xl font-bold tracking-tight text-white">
        AI<span className="text-blue-500">Sight</span>
      </a>

      {email ? (
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
              {email[0].toUpperCase()}
            </div>
            <span className="hidden sm:block max-w-[160px] truncate">{email}</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#111827] border border-white/10 shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-xs text-gray-500">ログイン中</p>
                <p className="text-sm text-white truncate">{email}</p>
              </div>
              <a
                href="/mypage"
                className="block w-full px-4 py-3 text-sm text-gray-300 hover:bg-white/5 text-left transition"
                onClick={() => setOpen(false)}
              >
                マイページ
              </a>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-sm text-red-400 hover:bg-white/5 text-left transition"
              >
                ログアウト
              </button>
            </div>
          )}
        </div>
      ) : (
        <a
          href="/login"
          className="text-sm text-blue-400 hover:text-blue-300 transition"
        >
          ログイン
        </a>
      )}
    </nav>
  );
}
