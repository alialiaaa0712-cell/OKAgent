import { useRef, KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function InputBar({ onSend, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const text = ref.current?.value.trim();
    if (!text || disabled) return;
    ref.current!.value = "";
    onSend(text);
  }

  return (
    <div className="input-bar">
      <textarea
        ref={ref}
        className="input-textarea"
        placeholder="Message… (Enter to send, Shift+Enter for newline)"
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
      />
      <button className="send-btn" onClick={submit} disabled={disabled}>
        Send
      </button>
    </div>
  );
}
