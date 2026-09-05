"use client";

import { useRef, useState } from "react";
import { sendTutorMessage, type ChatMessage } from "@/app/(app)/tutor/actions";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Sat sri akal! 🙏 I'm your Punjabi tutor. Ask me anything — how to say something, why a sentence is built a certain way, or for practice. Try: \"How do I ask my wife if she's eaten?\"",
};

export function TutorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  function scrollToEnd() {
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    scrollToEnd();

    // Exclude the canned greeting from what we send to the model.
    const history = next.filter((m) => m !== GREETING);
    const res = await sendTutorMessage(history);
    setLoading(false);

    if ("reply" in res) {
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } else {
      setError(
        res.error === "tutor-not-configured"
          ? "Add an ANTHROPIC_API_KEY to .env.local to enable the tutor (see SETUP.md)."
          : "Something went wrong — try again.",
      );
    }
    scrollToEnd();
  }

  return (
    <div className="flex min-h-[60vh] flex-col gap-3">
      <div className="flex-1 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-brand text-brand-contrast"
                  : "border border-border bg-surface"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-muted">
              thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-center text-xs text-danger">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="sticky bottom-0 flex gap-2 bg-background/80 py-2 backdrop-blur"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your tutor…"
          disabled={loading}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-contrast hover:bg-brand-strong disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
