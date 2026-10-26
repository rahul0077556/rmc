import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bot,
  Sparkles,
  X,
  Send,
  RotateCcw,
  Maximize2,
  Minimize2,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  Truck,
  FlaskConical,
  Warehouse,
  FileSpreadsheet,
  Boxes,
  KeyRound,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/auth-context";
import { useChatbot, type ChatMessage } from "@/lib/chatbot-store";
import { cn } from "@/lib/utils";

// Quick starter chips displayed on top of the chat
const STARTER_PROMPTS = [
  { label: "🚀 Plan trips & dispatch", query: "How do I plan a trip and send to production?" },
  { label: "📊 All 13 plant reports", query: "Explain all 13 official plant reports" },
  { label: "🧪 QC cube & slump test", query: "How do QC slump and cube tests work?" },
  { label: "📦 Cement & material stock", query: "What is the live cement and material stock?" },
  { label: "🏭 CRB-75 vs SP-30", query: "What is the difference between CRB-75 and SP-30 batching?" },
  { label: "➕ Create purchase order", query: "How to create a new purchase order?" },
  { label: "🔑 Demo login accounts", query: "Show all demo login accounts and passwords" },
];

export function RmcChatbot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    isOpen,
    isExpanded,
    isThinking,
    messages,
    open,
    close,
    toggle,
    toggleExpand,
    sendMessage,
    clear,
  } = useChatbot();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom whenever messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isThinking]);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isThinking) return;
    const text = input;
    setInput("");
    void sendMessage(text, user?.role);
  };

  const handleQuickPrompt = (query: string) => {
    void sendMessage(query, user?.role);
  };

  const handleActionClick = (to: string) => {
    void navigate({ to });
    // On small mobile screens, close chatbot on navigation for better UX
    if (window.innerWidth < 640) {
      close();
    }
  };

  return (
    <>
      {/* Floating Launcher Trigger */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
          <button
            onClick={() => toggle(user?.role)}
            aria-label="Open Sai RMC Plant Copilot"
            className="group relative flex h-11 sm:h-13 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-blue-600 px-3 sm:px-4 py-2 text-white shadow-xl shadow-primary/25 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/40 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {/* Animated Pulse Dot */}
            <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-400" />
            </span>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold leading-none tracking-tight">RMC Copilot</span>
                <span className="text-[10px] text-white/80 leading-tight">Ask AI</span>
              </div>
            </div>

            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300 animate-pulse ml-0.5" />
          </button>
        </div>
      )}

      {/* Chatbot Window Dialog */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300",
            // Desktop dimensions: compact vs expanded
            isExpanded
              ? "bottom-5 right-5 h-[720px] w-[620px] max-w-[95vw] max-h-[92vh]"
              : "bottom-5 right-5 h-[620px] w-[420px] max-w-[95vw] max-h-[88vh]",
            // Mobile dimensions: full width bottom sheet
            "max-sm:bottom-2 max-sm:right-2 max-sm:left-2 max-sm:w-auto max-sm:h-[86vh] max-sm:rounded-2xl"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-card via-card to-primary/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Bot className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Sai RMC Copilot</h3>
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-medium border-primary/30 text-primary">
                    AI Online
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Plant Assistant & Operational Help</p>
              </div>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={clear}
                title="Reset conversation"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpand}
                title={isExpanded ? "Collapse view" : "Expand view"}
                className="hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={close}
                title="Close Copilot"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Starter Chips */}
          <div className="border-b border-border/40 bg-muted/30 px-3 py-2 overflow-x-auto scrollbar-none flex gap-1.5">
            {STARTER_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(p.query)}
                className="shrink-0 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus:outline-none"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex flex-col gap-1.5", msg.sender === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl p-3.5 shadow-sm text-sm",
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-muted/60 border border-border/50 text-foreground rounded-bl-xs"
                  )}
                >
                  {msg.sender === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div>{renderMarkdown(msg.text)}</div>
                  )}

                  {/* Action Buttons inside Assistant Message */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap gap-2">
                      {msg.actions.map((act, aIdx) => (
                        <Button
                          key={aIdx}
                          size="sm"
                          variant="secondary"
                          onClick={() => handleActionClick(act.to)}
                          className="h-7 px-2.5 text-xs font-medium bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 transition-all gap-1"
                        >
                          {act.label}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Follow-up Question Chips */}
                {msg.followUps && msg.followUps.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 pl-1 max-w-[92%]">
                    {msg.followUps.map((fu, fIdx) => (
                      <button
                        key={fIdx}
                        onClick={() => handleQuickPrompt(fu)}
                        className="rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/15 transition-all text-left flex items-center gap-1"
                      >
                        <ChevronRight className="h-3 w-3 shrink-0" />
                        <span>{fu}</span>
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-muted-foreground px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {/* Thinking / Typing Animation */}
            {isThinking && (
              <div className="flex items-start gap-2">
                <div className="rounded-2xl rounded-bl-xs border border-border/50 bg-muted/60 p-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                    <span className="text-xs text-muted-foreground ml-1.5">Consulting plant knowledge base...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <form
            onSubmit={handleSend}
            className="border-t border-border/60 bg-card p-3 flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, dispatch, batching, reports, mix designs..."
              className="flex-1 bg-muted/40 border-border/70 text-sm focus-visible:ring-primary h-10"
              disabled={isThinking}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isThinking}
              className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

/**
 * Lightweight safe markdown parser for rendering assistant replies
 */
function renderMarkdown(content: string) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-semibold text-sm text-foreground mt-2 mb-1 flex items-center gap-1.5">
              {renderInline(line.replace("### ", ""))}
            </h4>
          );
        }
        if (line.startsWith("#### ")) {
          return (
            <h5 key={idx} className="font-semibold text-xs text-foreground/90 uppercase tracking-wider mt-2 mb-0.5">
              {renderInline(line.replace("#### ", ""))}
            </h5>
          );
        }
        // Bullet list
        if (line.startsWith("* ") || line.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="text-primary mt-1 text-xs shrink-0">•</span>
              <span className="flex-1 text-xs">{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        // Numbered list
        const numMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="font-medium text-primary text-xs shrink-0 mt-0.5">{numMatch[1]}.</span>
              <span className="flex-1 text-xs">{renderInline(numMatch[2])}</span>
            </div>
          );
        }
        // Empty line
        if (!line.trim()) {
          return <div key={idx} className="h-0.5" />;
        }
        // Normal paragraph
        return (
          <p key={idx} className="text-xs">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses bold (**text**), italics (*text*), and inline code (`code`)
 */
function renderInline(text: string) {
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] font-semibold text-primary border border-border/40"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return (
        <em key={i} className="text-muted-foreground italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}
