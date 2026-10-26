import { useEffect, useState } from "react";
import { processChatbotQuery, type ChatAction, type ChatbotResponse } from "./chatbot-engine";
import type { Role } from "@/types";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
  actions?: ChatAction[];
  followUps?: string[];
}

interface ChatbotState {
  isOpen: boolean;
  isExpanded: boolean;
  isThinking: boolean;
  messages: ChatMessage[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-1",
    sender: "assistant",
    text: `### 👋 Welcome to Sai RMC Copilot!\n\nI am your intelligent AI assistant for the **Sai Ready-Mix Concrete Command Center** (Mulkhed Plant).\n\nAsk me anything about:\n* **Operations & Workflows:** How to plan trips, create orders, approve dispatches, or batch concrete\n* **All 13 Plant Reports:** MPR, HR Store, TM Average, Strength Data, CRB-75 & SP-30 consumption\n* **Quality Control & Concrete Tech:** IS 456 slump checks, 7/28-day cube breaks, mix designs M15–M40\n* **Live Plant Telemetry:** Inquire about live cement stock, pending orders, or available trucks\n\n*Tap any suggestion below or type your question to begin!*`,
    timestamp: new Date(),
    actions: [
      { label: "🚀 Plan & Dispatch Trips", to: "/dispatcher" },
      { label: "📊 Explore 13 Reports", to: "/reports" },
      { label: "🧪 QA/QC Lab Guide", to: "/qa" },
    ],
    followUps: [
      "How do I plan a trip and send to production?",
      "Explain all 13 plant reports",
      "Check live cement and raw material stock",
      "How does QC cube testing work?",
      "Show demo login credentials",
    ],
  },
];

let globalState: ChatbotState = {
  isOpen: false,
  isExpanded: false,
  isThinking: false,
  messages: INITIAL_MESSAGES,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const chatbotStore = {
  getState(): ChatbotState {
    return globalState;
  },

  open(initialQuery?: string, userRole?: Role) {
    globalState = { ...globalState, isOpen: true };
    notify();
    if (initialQuery) {
      void this.sendMessage(initialQuery, userRole);
    }
  },

  close() {
    globalState = { ...globalState, isOpen: false };
    notify();
  },

  toggle(userRole?: Role) {
    if (globalState.isOpen) {
      this.close();
    } else {
      this.open(undefined, userRole);
    }
  },

  toggleExpand() {
    globalState = { ...globalState, isExpanded: !globalState.isExpanded };
    notify();
  },

  clear() {
    globalState = {
      ...globalState,
      messages: INITIAL_MESSAGES,
      isThinking: false,
    };
    notify();
  },

  async sendMessage(text: string, userRole?: Role) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date(),
    };

    globalState = {
      ...globalState,
      isOpen: true,
      messages: [...globalState.messages, userMsg],
      isThinking: true,
    };
    notify();

    // Small natural delay for typing response
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const response: ChatbotResponse = await processChatbotQuery(trimmed, userRole);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: "assistant",
        text: response.text,
        timestamp: new Date(),
        actions: response.actions,
        followUps: response.followUps,
      };

      globalState = {
        ...globalState,
        messages: [...globalState.messages, assistantMsg],
        isThinking: false,
      };
      notify();
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "I encountered an error retrieving that operational information. Please try asking again or check the documentation in Reports.",
        timestamp: new Date(),
      };
      globalState = {
        ...globalState,
        messages: [...globalState.messages, errorMsg],
        isThinking: false,
      };
      notify();
    }
  },
};

export function useChatbot() {
  const [state, setState] = useState<ChatbotState>(chatbotStore.getState());

  useEffect(() => {
    const update = () => setState(chatbotStore.getState());
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    ...state,
    open: (initialQuery?: string, userRole?: Role) => chatbotStore.open(initialQuery, userRole),
    close: () => chatbotStore.close(),
    toggle: (userRole?: Role) => chatbotStore.toggle(userRole),
    toggleExpand: () => chatbotStore.toggleExpand(),
    sendMessage: (text: string, userRole?: Role) => chatbotStore.sendMessage(text, userRole),
    clear: () => chatbotStore.clear(),
  };
}
