import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../api";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div className={`bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
      {isUser ? (
        <pre className="bubble-content">{message.content}</pre>
      ) : (
        <div className="bubble-content bubble-md">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
