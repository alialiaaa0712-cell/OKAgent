import { useEffect, useRef } from "react";
import type { ChatMessage } from "../api";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  activeTool: string | null;
}

export function ChatWindow({ messages, activeTool }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTool]);

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <p className="chat-empty">Start a conversation...</p>
      )}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {activeTool && (
        <div className="tool-indicator">⚙ Running {activeTool}...</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
