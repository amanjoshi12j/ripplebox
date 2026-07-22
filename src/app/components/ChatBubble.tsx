import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { sendMessageToLex } from "../lib/lexConfig";
import { useAuth } from "../context/AuthContext";
import { getMe, getMyReferrals, getSalons, getMyFavorites, getMyAppointments } from "../lib/apiClient";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
}

// Stable per-tab session id so the Lex bot can maintain conversation context.
const sessionId = `session-${Math.random().toString(36).slice(2)}`;

export function ChatBubble() {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", sender: "bot", text: "Hey! 👋 I'm your RippleBox assistant. Ask me anything about referrals, rewards, or your account!" },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [sessionAttributes, setSessionAttributes] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen]);

  // Real data for the bot to personalize with, replacing an old dummy
  // lookup its fulfillment Lambda used to fall back to - see lexConfig.ts.
  useEffect(() => {
    if (!auth.idToken) return;
    Promise.all([
      getMe(auth.idToken),
      getMyReferrals(auth.idToken),
      getSalons(),
      getMyFavorites(auth.idToken),
      getMyAppointments(auth.idToken),
    ])
      .then(([me, referrals, salons, favoriteIds, appointments]) => {
        const pendingCount = referrals.referrals.filter((r) => r.status === "pending").length;

        // Points are per-salon in this app, never a single pooled number -
        // same rule as everywhere else (ClientHome, redemption, etc.) - so
        // the bot needs the real breakdown, not a single figure. Lex
        // session attributes are flat strings, so this gets joined into one
        // readable line rather than sent as structured data.
        const salonName = (salonId: string) => salons.find((s) => s.id === salonId)?.name ?? "a salon";
        const pointsBySalon = me.salonPoints
          .filter((p) => p.points > 0)
          .map((p) => `${salonName(p.salonId)}: ${p.points} points`)
          .join(", ");

        const favoriteSalons = favoriteIds.map(salonName).join(", ");

        // Appointments are a real in-app feature (booking, Pay Now/Pay
        // Later, status tracking) - the bot used to have no idea these
        // existed and would wrongly tell users to "check with the salon
        // directly". Soonest upcoming one only, to keep this a short string.
        const upcoming = appointments
          .filter((a) => a.status === "pending" || a.status === "confirmed")
          .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
        const nextAppointment = upcoming
          ? `${upcoming.serviceName} at ${upcoming.salonName} on ${upcoming.date} at ${upcoming.time} (${upcoming.status}, ${upcoming.paymentMethod === "pay_now" ? "paid" : "pay at salon"})`
          : "no upcoming appointments";

        setSessionAttributes({
          name: me.name,
          referral_code: me.referralCode ?? "not assigned yet",
          referrals: String(referrals.totalCompleted),
          pending_referrals: String(pendingCount),
          points_by_salon: pointsBySalon || "no points yet at any salon",
          favorite_salons: favoriteSalons || "none yet",
          next_appointment: nextAppointment,
        });
      })
      .catch(() => {
        // The bot still works without personalization if this fails - not
        // worth blocking or erroring the whole widget over.
      });
  }, [auth.idToken]);

  const handleSend = async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isSending) return;

    setShowQuickReplies(false);
    const userMessage: ChatMessage = { id: `${Date.now()}-user`, sender: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const reply = await sendMessageToLex(trimmed, sessionId, sessionAttributes);
      setMessages((prev) => [...prev, { id: `${Date.now()}-bot`, sender: "bot", text: reply }]);
    } catch (err) {
      console.error("Chatbot error:", err);
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-error`, sender: "bot", text: "Something went wrong reaching the chatbot. Try again in a moment." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto pointer-events-none">
      {/* Chat window */}
      {isOpen && (
        <div className="pointer-events-auto absolute bottom-28 right-4 w-[calc(100%-2rem)] max-w-sm h-[28rem] bg-white/95 dark:bg-gray-800/90 glass-surface rounded-3xl shadow-2xl dark:shadow-black/50 border border-gray-100 dark:border-gray-700/60 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-600 dark:to-pink-600 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#2d2d2d] dark:text-white">RippleBox Assistant</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#2d2d2d] dark:text-white hover:opacity-70"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] text-[#2d2d2d]"
                      : "bg-gray-100 dark:bg-gray-700 text-[#2d2d2d] dark:text-gray-100"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-3 py-2 flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin text-gray-500 dark:text-gray-300" />
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          {showQuickReplies && (
            <div className="px-3 py-2 flex gap-2 flex-wrap border-t border-gray-100 dark:border-gray-700">
              {["How do I refer a friend?", "What rewards do I get?", "How do I redeem my bonus?"].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#e6d7f5] text-[#2d2d2d] dark:text-gray-100 dark:border-purple-500 hover:bg-[#e6d7f5] dark:hover:bg-purple-900/40 transition-colors whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm text-[#2d2d2d] dark:text-gray-100 outline-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={isSending || !input.trim()}
              className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] flex items-center justify-center disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={16} className="text-[#2d2d2d]" />
            </button>
          </div>
        </div>
      )}

      {/* Floating bubble button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="pointer-events-auto absolute bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] dark:from-purple-500 dark:to-pink-500 shadow-xl dark:shadow-purple-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Open chat"
      >
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#d4af37] dark:bg-amber-400 border-2 border-white dark:border-gray-900 animate-pulse" />
        )}
        {isOpen ? <X size={24} className="text-[#2d2d2d] dark:text-white" /> : <MessageCircle size={24} className="text-[#2d2d2d] dark:text-white" />}
      </button>
    </div>
  );
}
