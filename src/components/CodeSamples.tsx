"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GATEWAY_BASE } from "@/lib/app-url";

type Lang = "curl" | "javascript" | "python" | "php";

const labels: Record<Lang, string> = {
  curl: "cURL",
  javascript: "Node.js",
  python: "Python",
  php: "PHP",
};

export default function CodeSamples({ slug, endpoint }: { slug: string; endpoint: string }) {
  const [lang, setLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState(false);

  const base = `${GATEWAY_BASE}/${slug}`;
  const url = `${base}${endpoint}`;

  const samples: Record<Lang, string> = {
    curl: `curl -X GET "${url}" \\
  -H "X-Zephiel-Key: $ZEPHIEL_API_KEY" \\
  -H "Accept: application/json"`,
    javascript: `const res = await fetch("${url}", {
  headers: {
    "X-Zephiel-Key": process.env.ZEPHIEL_API_KEY,
    Accept: "application/json",
  },
});

if (!res.ok) throw new Error(\`Zephiel error \${res.status}\`);
const data = await res.json();
console.log(data);`,
    python: `import os, requests

res = requests.get(
    "${url}",
    headers={"X-Zephiel-Key": os.environ["ZEPHIEL_API_KEY"]},
    timeout=10,
)
res.raise_for_status()
print(res.json())`,
    php: `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["X-Zephiel-Key: " . getenv("ZEPHIEL_API_KEY")],
]);
$data = json_decode(curl_exec($ch), true);
print_r($data);`,
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(samples[lang]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#0c1220]">
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-2">
        {(Object.keys(labels) as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              lang === l ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            )}
          >
            {labels[l]}
          </button>
        ))}
        <button
          onClick={copy}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-6 text-slate-200">
        <code className="font-mono">{samples[lang]}</code>
      </pre>
    </div>
  );
}
