"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { transformHistoryToChartData, type ChartDataPoint } from "@/lib/score-history";

type ScoreHistoryData = {
  month: string;
  total_score: number;
  scores: Record<string, number>;
  technical_score: number;
};

type Props = {
  history: ScoreHistoryData[];
};

const COLORS = {
  total: "#3b82f6", // blue-500
  content: "#22c55e", // green-500
  technical: "#a855f7", // purple-500
  citation: "#f59e0b", // amber-500
};

export default function ScoreHistoryChart({ history }: Props) {
  const data = transformHistoryToChartData(history);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        データがありません
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="monthLabel"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#fff",
            }}
            labelStyle={{ color: "#9ca3af" }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                total: "総合スコア",
                content: "コンテンツ",
                technical: "技術",
                citation: "サイテーション",
              };
              return [`${value}点`, labels[String(name)] || String(name)];
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                total: "総合",
                content: "コンテンツ",
                technical: "技術",
                citation: "引用",
              };
              return <span className="text-gray-400 text-sm">{labels[value] || value}</span>;
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke={COLORS.total}
            strokeWidth={2}
            dot={{ r: 4, fill: COLORS.total }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="content"
            stroke={COLORS.content}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.content }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="technical"
            stroke={COLORS.technical}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.technical }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="citation"
            stroke={COLORS.citation}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.citation }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
