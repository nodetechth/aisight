"use client";

import { useState } from "react";

type AiCrawlerStatus = {
  userAgent: string;
  displayName: string;
  allowed: boolean;
  disallowRules: string[];
};

type TechnicalCheckResult = {
  llmsTxt: {
    exists: boolean;
    location: string | null;
    content: string | null;
  };
  robotsTxt: {
    exists: boolean;
    crawlers: AiCrawlerStatus[];
    allBlocked: boolean;
    partiallyBlocked: boolean;
  };
  score: number;
  issues: string[];
};

type Props = {
  technicalCheck: TechnicalCheckResult;
};

export default function TechnicalCheck({ technicalCheck }: Props) {
  const [showLlmsHelp, setShowLlmsHelp] = useState(false);
  const [showRobotsHelp, setShowRobotsHelp] = useState(false);

  const { llmsTxt, robotsTxt, score, issues } = technicalCheck;

  return (
    <div className="space-y-4">
      {/* スコア表示 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">技術的整備スコア</span>
        <span className={`text-lg font-bold ${
          score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-gray-400"
        }`}>
          {score > 0 ? "+" : ""}{score}点
        </span>
      </div>

      {/* 問題点 */}
      {issues.length > 0 && (
        <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
          {issues.map((issue, i) => (
            <p key={i} className="text-xs text-yellow-400 flex items-start gap-2">
              <span>⚠</span>
              <span>{issue}</span>
            </p>
          ))}
        </div>
      )}

      {/* llms.txt チェック */}
      <div className="p-4 rounded-xl bg-white/2 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <span className="font-medium text-white">llms.txt</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            llmsTxt.exists
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}>
            {llmsTxt.exists ? "✅ 存在" : "❌ 未設置"}
          </span>
        </div>

        {llmsTxt.exists && llmsTxt.location && (
          <p className="text-xs text-gray-500 mb-2">
            場所: {llmsTxt.location}
          </p>
        )}

        <button
          onClick={() => setShowLlmsHelp(!showLlmsHelp)}
          className="text-xs text-blue-400 hover:text-blue-300 transition"
        >
          {showLlmsHelp ? "閉じる" : "llms.txt とは？ 設置方法を見る"}
        </button>

        {showLlmsHelp && (
          <div className="mt-3 p-3 rounded-lg bg-white/3 text-xs text-gray-400 leading-relaxed">
            <p className="mb-2">
              <strong className="text-white">llms.txt</strong> は、AIがあなたのサイトを理解するためのガイドファイルです。
              サイトの概要、提供サービス、連絡先などを記載することで、AIがより正確にサイトを紹介できるようになります。
            </p>
            <p className="mb-2">設置場所（いずれか）:</p>
            <ul className="list-disc list-inside mb-2 pl-2">
              <li>/.well-known/llms.txt（推奨）</li>
              <li>/llms.txt</li>
            </ul>
            <p className="mb-2">記載例:</p>
            <pre className="p-2 rounded bg-black/30 overflow-x-auto text-green-300">
{`# Site Information
name: 株式会社〇〇
description: 福岡市のWebマーケティング会社
services: SEO対策, LLMO対策, Web制作
contact: info@example.com
url: https://example.com`}
            </pre>
          </div>
        )}
      </div>

      {/* robots.txt チェック */}
      <div className="p-4 rounded-xl bg-white/2 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-medium text-white">AIクローラー許可状況</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            robotsTxt.allBlocked
              ? "bg-red-500/20 text-red-400"
              : robotsTxt.partiallyBlocked
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-green-500/20 text-green-400"
          }`}>
            {robotsTxt.allBlocked
              ? "🚫 全ブロック"
              : robotsTxt.partiallyBlocked
              ? "⚠ 一部ブロック"
              : "✅ 全許可"}
          </span>
        </div>

        {/* クローラー一覧テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-gray-500 font-normal">クローラー</th>
                <th className="text-right py-2 text-gray-500 font-normal">状態</th>
              </tr>
            </thead>
            <tbody>
              {robotsTxt.crawlers.map((crawler) => (
                <tr key={crawler.userAgent} className="border-b border-white/5">
                  <td className="py-2 text-gray-300">{crawler.displayName}</td>
                  <td className="py-2 text-right">
                    <span className={crawler.allowed ? "text-green-400" : "text-red-400"}>
                      {crawler.allowed ? "✅ 許可" : "🚫 ブロック"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => setShowRobotsHelp(!showRobotsHelp)}
          className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition"
        >
          {showRobotsHelp ? "閉じる" : "ブロックを解除する方法"}
        </button>

        {showRobotsHelp && (
          <div className="mt-3 p-3 rounded-lg bg-white/3 text-xs text-gray-400 leading-relaxed">
            <p className="mb-2">
              <strong className="text-white">robots.txt</strong> でAIクローラーをブロックしていると、
              AIがあなたのサイトの情報を取得できず、引用される可能性が大幅に低下します。
            </p>
            <p className="mb-2">ブロックを解除するには、robots.txt から以下のような記述を削除してください:</p>
            <pre className="p-2 rounded bg-black/30 overflow-x-auto text-red-300 mb-2">
{`User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /`}
            </pre>
            <p className="mb-2">または、明示的に許可する場合:</p>
            <pre className="p-2 rounded bg-black/30 overflow-x-auto text-green-300">
{`User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
