import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

type MessageSection =
  | "all"
  | "overview"
  | "training"
  | "nutrition"
  | "recovery"
  | "decisions";

type ChatMessage = {
  id: string;
  role: "user" | "sensei" | "system";
  text: string;
  pending?: boolean;
  section?: MessageSection;
};

type SenseiConnected = {
  vision?: {
    present?: boolean;
    correction?: string | null;
    severity?: string | null;
    fix_next_rep?: string | null;
  };
  fuel?: {
    present?: boolean;
    score?: number | null;
    rating?: string | null;
  };
  psychology?: {
    present?: boolean;
    summary?: string;
    commandStyle?: string;
  };
  profile?: {
    present?: boolean;
    baseArt?: string;
    paceStyle?: string;
    weaknesses?: string;
  };
  gyms?: Array<{
    id: string;
    name: string;
    location: string;
    compatibility: number;
    disciplineMatch: string[];
    styleMatch: string[];
    watchOut: string[];
    href?: string;
    verified: boolean;
  }>;
};

type SenseiSessionState = {
  lastDecision?: string;
  lastCommand?: string;
  lastWhy?: string;
  lastUpdated?: string;
};

function clean(input: unknown) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function preserveBlocks(input: unknown) {
  return String(input ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeText(input: unknown, max = 5000) {
  const value = preserveBlocks(input);
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function getDefaultConnected(): SenseiConnected {
  return {
    vision: {
      present: false,
      correction: null,
      severity: null,
      fix_next_rep: null,
    },
    fuel: {
      present: false,
      score: null,
      rating: null,
    },
    psychology: {
      present: false,
      summary: "No psychology data loaded.",
      commandStyle: "No command style loaded",
    },
    profile: {
      present: false,
      baseArt: "No base art loaded",
      paceStyle: "No pace style loaded",
      weaknesses: "No weakness data loaded",
    },
    gyms: [],
  };
}

function normalizeConnected(input: any): SenseiConnected {
  const base = getDefaultConnected();

  return {
    ...base,
    ...input,
    vision: {
      ...base.vision,
      ...(input?.vision || {}),
      correction: clean(input?.vision?.correction) || null,
      severity: clean(input?.vision?.severity) || null,
      fix_next_rep: clean(input?.vision?.fix_next_rep) || null,
    },
    fuel: {
      ...base.fuel,
      ...(input?.fuel || {}),
      score:
        typeof input?.fuel?.score === "number"
          ? input.fuel.score
          : input?.fuel?.score != null
          ? Number(input.fuel.score) || null
          : null,
      rating: clean(input?.fuel?.rating) || null,
    },
    psychology: {
      ...base.psychology,
      ...(input?.psychology || {}),
      summary:
        preserveBlocks(input?.psychology?.summary) ||
        "No psychology data loaded.",
      commandStyle:
        clean(input?.psychology?.commandStyle) || "No command style loaded",
    },
    profile: {
      ...base.profile,
      ...(input?.profile || {}),
      baseArt: clean(input?.profile?.baseArt) || "No base art loaded",
      paceStyle: clean(input?.profile?.paceStyle) || "No pace style loaded",
      weaknesses:
        preserveBlocks(input?.profile?.weaknesses) ||
        "No weakness data loaded",
    },
    gyms: Array.isArray(input?.gyms)
      ? input.gyms.map((gym: any) => ({
          id: clean(gym?.id),
          name: clean(gym?.name),
          location: clean(gym?.location),
          compatibility:
            typeof gym?.compatibility === "number"
              ? gym.compatibility
              : Number(gym?.compatibility) || 0,
          disciplineMatch: Array.isArray(gym?.disciplineMatch)
            ? gym.disciplineMatch.map((x: any) => clean(x)).filter(Boolean)
            : [],
          styleMatch: Array.isArray(gym?.styleMatch)
            ? gym.styleMatch.map((x: any) => clean(x)).filter(Boolean)
            : [],
          watchOut: Array.isArray(gym?.watchOut)
            ? gym.watchOut.map((x: any) => clean(x)).filter(Boolean)
            : [],
          href: clean(gym?.href) || undefined,
          verified: !!gym?.verified,
        }))
      : [],
  };
}

function normalizeMessages(input: any): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((msg: any) => ({
      id: clean(msg?.id) || `restored_${Math.random().toString(36).slice(2, 8)}`,
      role:
        msg?.role === "user" || msg?.role === "sensei" || msg?.role === "system"
          ? msg.role
          : "system",
      text: safeText(msg?.text, 6000),
      pending: false,
      section:
        msg?.section === "all" ||
        msg?.section === "overview" ||
        msg?.section === "training" ||
        msg?.section === "nutrition" ||
        msg?.section === "recovery" ||
        msg?.section === "decisions"
          ? msg.section
          : "decisions",
    }))
    .filter((msg: ChatMessage) => msg.text);
}

function normalizeSession(input: any): SenseiSessionState {
  return {
    lastDecision: clean(input?.lastDecision),
    lastCommand: preserveBlocks(input?.lastCommand),
    lastWhy: preserveBlocks(input?.lastWhy),
    lastUpdated: clean(input?.lastUpdated),
  };
}

async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await getSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("sensei_sessions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        ok: true,
        exists: false,
        payload: {
          activeDirective: "",
          decisionMode: "FALLBACK",
          connected: getDefaultConnected(),
          chatMessages: [],
          sessionState: {
            lastDecision: "",
            lastCommand: "",
            lastWhy: "",
            lastUpdated: "",
          },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      exists: true,
      payload: {
        activeDirective: clean(data.active_directive),
        decisionMode: data.decision_mode === "STRICT" ? "STRICT" : "FALLBACK",
        connected: normalizeConnected(data.connected),
        chatMessages: normalizeMessages(data.chat_messages),
        sessionState: normalizeSession({
          lastDecision: data.last_decision,
          lastCommand: data.last_command,
          lastWhy: data.last_why,
          lastUpdated: data.last_updated,
        }),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load Sensei state." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const activeDirective = clean(body?.activeDirective);
    const decisionMode = body?.decisionMode === "STRICT" ? "STRICT" : "FALLBACK";
    const connected = normalizeConnected(body?.connected || {});
    const chatMessages = normalizeMessages(body?.chatMessages || []);
    const sessionState = normalizeSession(body?.sessionState || {});

    const payload = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
      active_directive: activeDirective || null,
      decision_mode: decisionMode,
      last_decision: sessionState.lastDecision || null,
      last_command: sessionState.lastCommand || null,
      last_why: sessionState.lastWhy || null,
      last_updated: sessionState.lastUpdated || null,
      connected,
      chat_messages: chatMessages,
    };

    const { error } = await supabase
      .from("sensei_sessions")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to save Sensei state." },
      { status: 500 }
    );
  }
}