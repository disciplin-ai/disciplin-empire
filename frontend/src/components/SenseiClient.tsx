"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "system" | "sensei";
  content: string;
};

export default function SenseiClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content:
        "Ask Sensei for decisions, not motivation. The answer will stay tied to the active directive.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ✅ Auto-scroll ONLY chat container (not page)
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // ✅ Prevent page scroll when typing
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const preventScroll = (e: Event) => {
      e.stopPropagation();
    };

    el.addEventListener("wheel", preventScroll, { passive: false });

    return () => {
      el.removeEventListener("wheel", preventScroll);
    };
  }, []);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/sensei", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followups_id: "default",
          section_id: "questions",
          question: userMessage.content,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content:
              data.error || "Sensei failed: no usable response.",
          },
        ]);
      } else {
        const content =
          data.mode === "direct"
            ? data.answer
            : `${data.decision}`;

        setMessages((prev) => [
          ...prev,
          {
            role: "sensei",
            content,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Sensei crashed.",
        },
      ]);
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full max-h-[700px] rounded-2xl border border-white/10 bg-[#071018] overflow-hidden">
      
      {/* CHAT AREA */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-3 max-w-[85%] ${
              msg.role === "user"
                ? "ml-auto bg-green-900/30 border border-green-500/20"
                : msg.role === "system"
                ? "bg-yellow-900/30 border border-yellow-500/20"
                : "bg-[#0b1620] border border-white/10"
            }`}
          >
            <div className="text-xs opacity-60 mb-1 uppercase tracking-widest">
              {msg.role}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-sm opacity-50">Thinking...</div>
        )}
      </div>

      {/* INPUT AREA (FIXED — DOES NOT MOVE) */}
      <div className="border-t border-white/10 p-3 bg-[#071018]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Sensei something direct."
            rows={2}
            className="flex-1 resize-none rounded-xl bg-[#0b1620] border border-white/10 px-3 py-2 text-sm outline-none focus:border-green-500/40"
          />

          <button
            onClick={handleSend}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-green-500 text-black text-sm font-medium hover:bg-green-400 disabled:opacity-50"
          >
            Send
          </button>
        </div>

        <div className="text-xs opacity-50 mt-1">
          Enter = send · Shift + Enter = new line
        </div>
      </div>
    </div>
  );
}