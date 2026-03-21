"use client";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/analyze";
  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage("確認メールを送信しました。メールをご確認ください。");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage("メールアドレスまたはパスワードが正しくありません");
      else router.push(redirectTo);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const redirect = searchParams.get("redirect") || "/analyze";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}${redirect}`,
      },
    });
  };

  return (
    <main className="min-h-screen bg-[#080C14] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" className="text-2xl font-bold tracking-tight">
            AI<span className="text-blue-500">Sight</span>
          </a>
          <p className="text-gray-400 mt-2 text-sm">
            {isSignUp ? "アカウントを作成する" : "ログインする"}
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-gray-800 font-medium text-sm hover:bg-gray-100 transition mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.82v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.51 10.53c-.16-.48-.25-.99-.25-1.53s.09-1.05.25-1.53V5.4H1.82A8 8 0 0 0 .98 9c0 1.29.31 2.51.84 3.6l2.69-2.07z"/>
            <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.16 4.4l2.69 2.07c.63-1.89 2.39-3.29 4.47-3.29z"/>
          </svg>
          Googleでログイン
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-500">または</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="パスワード（8文字以上）"
            required
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl font-bold text-sm transition"
          >
            {loading ? "処理中..." : isSignUp ? "アカウントを作成" : "ログイン"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-center text-yellow-400">{message}</p>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          {isSignUp ? "すでにアカウントをお持ちの方は" : "アカウントをお持ちでない方は"}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setMessage(""); }}
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {isSignUp ? "ログイン" : "新規登録"}
          </button>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
