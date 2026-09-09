const encoder = new TextEncoder();

const RAW = "https://raw.githubusercontent.com/yoc02119-max/boat-command/main/line";
const GITHUB_REPO = "yoc02119-max/boat-command";
const QUEUE_TTL_SECONDS = 60 * 60 * 24 * 90;

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function verifyLineSignature(body, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64ToBytes(signature),
      encoder.encode(body),
    );
  } catch {
    return false;
  }
}

async function replyLine(replyToken, text, accessToken) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    console.error("LINE reply failed", res.status, await res.text());
  }
}

async function fetchJson(file) {
  const res = await fetch(`${RAW}/${file}?t=${Date.now()}`, {
    cf: { cacheTtl: 30, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return res.json();
}

function jstNow() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(
    fmt
      .formatToParts(new Date())
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

function progressText(s) {
  return [
    `🚤 BOAT COMMAND v${s.appVersion}`,
    `${s.venue}・総合進捗 ${s.overall}%`,
    "",
    `現在：${s.currentTask}`,
    `NEXT：${s.nextTask}`,
    "",
    "※GitHub最新ステータス",
  ].join("\n");
}

function phaseText(s) {
  return [
    `🚤 BOAT COMMAND v${s.appVersion}`,
    "",
    ...s.phases.map((x) => `${x.name}：${x.percent}%`),
  ].join("\n");
}

function trialText(s) {
  const ok = s.trial?.staticContract === "PASS";
  return [
    `🚤 BOAT COMMAND v${s.appVersion}`,
    "",
    ok ? "技術試用ゲート：PASS ✅" : "技術試用ゲート：HOLD ⚠️",
    "",
    "予想精度・収益性の認証：未完了",
    `現在：${s.currentTask}`,
    `NEXT：${s.nextTask}`,
    "",
    ok
      ? "早期試用の技術条件は通過。最終iPad実操作確認の段階。"
      : "今は試用開始しない。",
  ].join("\n");
}

function findNextRace(day) {
  const now = jstNow();
  if (day.dateJst !== now.date) return { stale: true };
  if (!day.eventActive) return { active: false };

  for (const r of day.deadlines || []) {
    const [h, m] = r.deadlineJst.split(":").map(Number);
    const deadlineMinutes = h * 60 + m;
    if (deadlineMinutes > now.minutes) {
      return {
        active: true,
        race: r.race,
        deadline: r.deadlineJst,
        remaining: deadlineMinutes - now.minutes,
      };
    }
  }
  return { active: true, finished: true };
}

function todayText(day) {
  const now = jstNow();
  if (day.dateJst !== now.date) {
    return [
      "🚤 蒲郡LIVE",
      "今日の開催データはまだ更新前です。",
      "安全側でLIVE判定は出しません。",
    ].join("\n");
  }

  if (!day.eventActive) {
    const lines = [
      "🚤 今日の蒲郡",
      "公式番組検知：開催なし",
      "LIVE予想対象：なし",
      "",
      "BOAT COMMANDは今日は蒲郡LIVE処理を走らせません。",
    ];
    if (day.nextEvent?.startDateJst) {
      lines.push(
        "",
        `次回開催：${day.nextEvent.startDateJst}`,
        day.nextEvent.title || "蒲郡開催",
      );
    }
    return lines.join("\n");
  }

  const next = findNextRace(day);
  const lines = ["🚤 今日の蒲郡", "公式番組検知：開催あり ✅", `全${day.raceCount}R`];
  if (next?.race) {
    lines.push(`次：${next.race}R`, `締切：${next.deadline}`, `約${next.remaining}分`);
  } else if (next?.finished) {
    lines.push("本日の締切はすべて終了");
  }
  return lines.join("\n");
}

function nextRaceText(day) {
  const next = findNextRace(day);
  if (next?.stale) {
    return "今日の蒲郡データはまだ更新前です。安全側で次レース判定を出しません。";
  }
  if (next?.active === false) {
    return "今日は蒲郡の開催を検知していないため、次レースはありません。";
  }
  if (next?.finished) {
    return "蒲郡は本日の全レース締切が終了しています。";
  }
  return [
    `🚤 次は蒲郡 ${next.race}R`,
    `締切 ${next.deadline}`,
    `あと約${next.remaining}分`,
    "",
    "※これは締切情報。予想READYとは別判定です。",
  ].join("\n");
}

function nextEventText(day) {
  if (day.nextEvent?.startDateJst) {
    return [
      "🚤 蒲郡 次回開催",
      `開始：${day.nextEvent.startDateJst}`,
      day.nextEvent.endDateJst ? `終了：${day.nextEvent.endDateJst}` : null,
      day.nextEvent.daysUntil != null ? `あと${day.nextEvent.daysUntil}日` : null,
      day.nextEvent.title ? `開催：${day.nextEvent.title}` : null,
      "",
      "※公式月間スケジュール由来",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "🚤 蒲郡 次回開催",
    "次回開催日程を自動取得できませんでした。",
    "安全側で日付は推測しません。",
  ].join("\n");
}

function helpText() {
  return [
    "BOAT COMMAND 接続中 ✅",
    "",
    "聞ける例：",
    "・進捗どう？",
    "・進捗の内訳",
    "・試用できる？",
    "・今日の蒲郡どう？",
    "・次のレースは？",
    "・次回開催いつ？",
    "・次なにやる？",
    "・改善キュー件数",
  ].join("\n");
}

async function loadIntentRoutes() {
  try {
    const cfg = await fetchJson("intent-routes.json");
    if (cfg?.schema !== "boat-command-line-intents-v1" || !Array.isArray(cfg.intents)) {
      throw new Error("intent contract invalid");
    }
    return cfg.intents;
  } catch (error) {
    console.error("intent routes fallback", error);
    return [];
  }
}

function matchPattern(text, pattern) {
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return text.toLowerCase().includes(String(pattern).toLowerCase());
  }
}

async function detectIntent(text) {
  const routes = await loadIntentRoutes();
  for (const route of routes) {
    if ((route.patterns || []).some((p) => matchPattern(text, p))) return route.name;
  }
  return null;
}

function normalizeGroupCommand(text) {
  return text
    .replace(/BOAT\s*COMMAND/gi, "")
    .replace(/ボートコマンド/g, "")
    .replace(/^\/bc\b/i, "")
    .trim();
}

function normalizeQuestion(text) {
  return String(text)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[?？!！。、，,.．・:：;；"'「」『』【】（）()\[\]［］{}<>〈〉《》]/g, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function questionFingerprint(text) {
  return sha256Hex(normalizeQuestion(text));
}

async function createGitHubLearningIssue(env, item) {
  if (!env.GITHUB_QUEUE_TOKEN) return null;

  const safeQuestion = item.text.replace(/[\r\n]+/g, " ").slice(0, 160);
  const title = `[LINE改善] ${safeQuestion}`;
  const body = [
    `<!-- boat-command-line-learning:${item.fingerprint} -->`,
    "## 未対応質問",
    "",
    item.text,
    "",
    "## Queue metadata",
    `- ticket: ${item.ticket}`,
    `- fingerprint: ${item.fingerprint}`,
    `- sourceType: ${item.sourceType}`,
    `- firstSeenAt: ${item.firstSeenAt}`,
    "- LINE user ID / group ID: not stored",
    "",
    "このIssueはBOAT COMMAND LINE改善キューから自動生成されています。蒲郡以外の競艇場には展開しないでください。",
  ].join("\n");

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_QUEUE_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "boat-command-line-webhook",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    console.error("GitHub queue sync failed", res.status, await res.text());
    return null;
  }

  const issue = await res.json();
  return {
    number: issue.number,
    url: issue.html_url,
  };
}

async function readQueueItem(env, key) {
  const raw = await env.LEARNING_QUEUE.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function findLegacyMatches(env, normalized, limit = 100) {
  const result = await env.LEARNING_QUEUE.list({ prefix: "q:", limit });
  const matches = [];

  for (const entry of result.keys || []) {
    if (entry.name.startsWith("q:v2:")) continue;
    const item = await readQueueItem(env, entry.name);
    if (!item?.text) continue;
    if (normalizeQuestion(item.text) === normalized) {
      matches.push({ key: entry.name, item });
    }
  }

  return matches;
}

async function enqueueUnsupported(env, text, sourceType) {
  if (!env.LEARNING_QUEUE) return { queued: false, reason: "NO_QUEUE_BINDING" };

  const normalized = normalizeQuestion(text);
  const fingerprint = await questionFingerprint(text);
  const ticket = fingerprint.slice(0, 8);
  const key = `q:v2:${fingerprint}`;
  const now = new Date().toISOString();

  let item = await readQueueItem(env, key);
  let repeated = Boolean(item);

  if (!item) {
    const legacyMatches = await findLegacyMatches(env, normalized);
    if (legacyMatches.length) {
      repeated = true;
      const first = legacyMatches[0].item;
      const firstSeenAt = first.firstSeenAt || first.createdAt || now;
      item = {
        schema: "boat-command-line-learning-item-v2",
        fingerprint,
        ticket,
        firstSeenAt,
        lastSeenAt: now,
        sourceType: sourceType || "unknown",
        sourceTypes: [...new Set([
          ...legacyMatches.map((x) => x.item.sourceType || "unknown"),
          sourceType || "unknown",
        ])],
        text: String(text).slice(0, 300),
        normalized,
        status: "queued",
        occurrences: legacyMatches.length + 1,
      };

      for (const legacy of legacyMatches) {
        await env.LEARNING_QUEUE.delete(legacy.key);
      }
    }
  }

  if (!item) {
    item = {
      schema: "boat-command-line-learning-item-v2",
      fingerprint,
      ticket,
      firstSeenAt: now,
      lastSeenAt: now,
      sourceType: sourceType || "unknown",
      sourceTypes: [sourceType || "unknown"],
      text: String(text).slice(0, 300),
      normalized,
      status: "queued",
      occurrences: 1,
    };
  } else if (item.schema === "boat-command-line-learning-item-v2") {
    item.lastSeenAt = now;
    item.occurrences = Number(item.occurrences || 1) + 1;
    item.sourceTypes = [...new Set([...(item.sourceTypes || []), sourceType || "unknown"])]
      .slice(0, 4);
    item.status = item.status === "implemented" ? "implemented" : "queued";
  }

  if (!item.githubIssueNumber) {
    const synced = await createGitHubLearningIssue(env, item);
    if (synced) {
      item.githubIssueNumber = synced.number;
      item.githubIssueUrl = synced.url;
    }
  }

  await env.LEARNING_QUEUE.put(key, JSON.stringify(item), {
    expirationTtl: QUEUE_TTL_SECONDS,
  });

  return {
    queued: true,
    id: ticket,
    repeated,
    occurrences: item.occurrences,
    githubIssueNumber: item.githubIssueNumber || null,
  };
}

async function queueCount(env) {
  if (!env.LEARNING_QUEUE) return null;
  const result = await env.LEARNING_QUEUE.list({ prefix: "q:", limit: 1000 });
  let count = 0;

  for (const entry of result.keys || []) {
    const item = await readQueueItem(env, entry.name);
    if (!item) continue;
    if (!item.status || item.status === "queued") count += 1;
  }

  return {
    count,
    capped: result.list_complete === false,
  };
}

async function markImplementedIfQueued(env, text, intent) {
  if (!env.LEARNING_QUEUE) return false;
  const fingerprint = await questionFingerprint(text);
  const key = `q:v2:${fingerprint}`;
  const item = await readQueueItem(env, key);
  if (!item || item.status !== "queued") return false;

  item.status = "implemented";
  item.resolvedAt = new Date().toISOString();
  item.resolvedIntent = intent;
  await env.LEARNING_QUEUE.put(key, JSON.stringify(item), {
    expirationTtl: QUEUE_TTL_SECONDS,
  });
  return true;
}

function withUpgradeNotice(answer, upgraded) {
  if (!upgraded) return answer;
  return [
    "✅ BOAT COMMANDアップデート",
    "この質問に対応できるようになりました。",
    "",
    answer,
  ].join("\n");
}

async function makeReply(text, env, sourceType) {
  if (/改善キュー.*件数|未対応.*件数/.test(text)) {
    const summary = await queueCount(env);
    if (!summary) return "改善キューはまだ接続前です。";
    return `🛠️ 改善キュー：${summary.count}${summary.capped ? "+" : ""}件`;
  }

  const intent = await detectIntent(text);

  if (intent === "next_race") {
    const answer = nextRaceText(await fetchJson("gamagori-day-status.json"));
    return withUpgradeNotice(answer, await markImplementedIfQueued(env, text, intent));
  }
  if (intent === "next_event") {
    const answer = nextEventText(await fetchJson("gamagori-day-status.json"));
    return withUpgradeNotice(answer, await markImplementedIfQueued(env, text, intent));
  }
  if (intent === "today_gamagori") {
    const answer = todayText(await fetchJson("gamagori-day-status.json"));
    return withUpgradeNotice(answer, await markImplementedIfQueued(env, text, intent));
  }

  const status = await fetchJson("boat-command-status.json");
  let answer = null;

  if (intent === "trial") answer = trialText(status);
  if (intent === "phase") answer = phaseText(status);
  if (intent === "progress") answer = progressText(status);
  if (intent === "next_task") {
    answer = [
      `🚤 BOAT COMMAND v${status.appVersion}`,
      `現在：${status.currentTask}`,
      `NEXT：${status.nextTask}`,
    ].join("\n");
  }
  if (intent === "version") {
    answer = `現在のBOAT COMMANDは v${status.appVersion} です。`;
  }
  if (intent === "help") answer = helpText();

  if (answer) {
    return withUpgradeNotice(answer, await markImplementedIfQueued(env, text, intent));
  }

  const queued = await enqueueUnsupported(env, text, sourceType);
  if (queued.queued) {
    const queueLine = queued.repeated
      ? `既存の改善キュー #${queued.id} を更新しました（${queued.occurrences}回目）。`
      : `改善キュー #${queued.id} に登録しました。`;
    return [
      "その質問はまだ未対応です 🛠️",
      queueLine,
      "対応できる形にアップデートしていきます。",
      queued.githubIssueNumber ? `開発連携：GitHub Issue #${queued.githubIssueNumber}` : null,
      "",
      "※LINEのユーザーIDやグループIDは保存していません。",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "その質問はまだ未対応です 🛠️",
    "改善キュー機能は現在接続準備中です。",
    "対応候補として扱います。",
  ].join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return new Response("BOAT COMMAND LINE webhook is running.", { status: 200 });
    }

    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("Not Found", { status: 404 });
    }

    if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN) {
      return new Response("Server configuration missing", { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature");
    const valid = await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET);
    if (!valid) return new Response("Invalid signature", { status: 401 });

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    for (const event of payload.events || []) {
      if (
        event.type !== "message" ||
        event.message?.type !== "text" ||
        !event.replyToken
      ) {
        continue;
      }

      let text = event.message.text.trim();
      const sourceType = event.source?.type || "unknown";
      const isGroup = sourceType === "group" || sourceType === "room";

      if (isGroup) {
        const called = /ボートコマンド|BOAT\s*COMMAND|^\/bc\b/i.test(text);
        if (!called) continue;
        text = normalizeGroupCommand(text);
      }

      try {
        const reply = await makeReply(text, env, sourceType);
        await replyLine(event.replyToken, reply, env.LINE_CHANNEL_ACCESS_TOKEN);
      } catch (error) {
        console.error(error);
        await replyLine(
          event.replyToken,
          [
            "BOAT COMMAND Webhookは稼働中です ✅",
            "ただし最新データの取得に失敗しました。",
            "少ししてからもう一度送ってください。",
          ].join("\n"),
          env.LINE_CHANNEL_ACCESS_TOKEN,
        );
      }
    }

    return new Response("OK", { status: 200 });
  },
};
