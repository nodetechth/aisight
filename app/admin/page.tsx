import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface UserPlan {
  id: string;
  plan: string;
  monthly_analysis_count: number | null;
  created_at: string;
  stripe_customer_id: string | null;
}

interface WaitlistEntry {
  email: string;
  created_at: string;
}

export default async function AdminPage() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ユーザープラン一覧
  const { data: plans } = await supabaseAdmin
    .from("user_plans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  // 先行登録リスト
  const { data: waitlist } = await supabaseAdmin
    .from("waiting_list")
    .select("email, created_at")
    .order("created_at", { ascending: false });

  // 集計
  const typedPlans = (plans ?? []) as UserPlan[];
  const proUsers = typedPlans.filter((p) => p.plan === "pro");
  const mrr = proUsers.length * 980;
  const totalDiagnoses = typedPlans.reduce(
    (sum, p) => sum + (p.monthly_analysis_count ?? 0),
    0
  );
  const waitlistCount = waitlist?.length ?? 0;

  // 診断回数ランキングTOP10
  const ranking = [...typedPlans]
    .sort(
      (a, b) =>
        (b.monthly_analysis_count ?? 0) - (a.monthly_analysis_count ?? 0)
    )
    .slice(0, 10);

  const typedWaitlist = (waitlist ?? []) as WaitlistEntry[];
  const latestWaitlistDate =
    typedWaitlist.length > 0 ? typedWaitlist[0].created_at : null;

  return (
    <div className="min-h-screen bg-[#080C14] text-white p-8">
      <h1 className="text-2xl font-bold mb-8">AISight 管理画面</h1>

      {/* セクション1: MRRサマリー */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-400 mb-4">
          MRRサマリー
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Proユーザー数" value={proUsers.length} unit="人" />
          <SummaryCard
            label="月間MRR"
            value={mrr.toLocaleString()}
            unit="円"
          />
          <SummaryCard label="先行登録者数" value={waitlistCount} unit="人" />
          <SummaryCard label="今月の総診断回数" value={totalDiagnoses} unit="回" />
        </div>
      </section>

      {/* セクション2: ユーザー一覧 */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-400 mb-4">
          ユーザー一覧（最新50件）
        </h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="px-4 py-3">ユーザーID</th>
                <th className="px-4 py-3">プラン</th>
                <th className="px-4 py-3">診断回数</th>
                <th className="px-4 py-3">登録日</th>
                <th className="px-4 py-3">Stripe顧客ID</th>
              </tr>
            </thead>
            <tbody>
              {typedPlans.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">
                    {p.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        p.plan === "pro"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {p.plan === "pro" ? "Pro" : "Free"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{p.monthly_analysis_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(p.created_at).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {p.stripe_customer_id
                      ? `${p.stripe_customer_id.slice(0, 12)}...`
                      : "-"}
                  </td>
                </tr>
              ))}
              {typedPlans.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    ユーザーがまだいません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* セクション3: 診断回数ランキング */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-400 mb-4">
          診断回数ランキング TOP10
        </h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="px-4 py-3">順位</th>
                <th className="px-4 py-3">ユーザーID</th>
                <th className="px-4 py-3">プラン</th>
                <th className="px-4 py-3">診断回数</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((p, i) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-bold text-blue-400">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">
                    {p.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        p.plan === "pro"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {p.plan === "pro" ? "Pro" : "Free"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {p.monthly_analysis_count ?? 0}
                  </td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* セクション4: 先行登録リスト */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-400 mb-4">
          先行登録リスト（{waitlistCount}件）
          {latestWaitlistDate && (
            <span className="text-sm font-normal ml-2">
              最新登録: {new Date(latestWaitlistDate).toLocaleDateString("ja-JP")}
            </span>
          )}
        </h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="px-4 py-3">メールアドレス</th>
                <th className="px-4 py-3">登録日</th>
              </tr>
            </thead>
            <tbody>
              {typedWaitlist.map((w, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-4 py-3">{w.email}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(w.created_at).toLocaleDateString("ja-JP")}
                  </td>
                </tr>
              ))}
              {typedWaitlist.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-400">
                    先行登録がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string;
  unit: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      <p className="text-3xl font-black text-blue-400">
        {value}
        <span className="text-lg font-normal text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}
