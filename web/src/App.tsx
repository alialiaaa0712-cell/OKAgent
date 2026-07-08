import { useEffect, useState, useCallback } from "react";
import { SessionSidebar } from "./components/SessionSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { InputBar } from "./components/InputBar";
import { useChat } from "./hooks/useChat";
import { listSessions, createSession, deleteSession, getMessages } from "./api";
import type { SessionMeta } from "./api";
import "./App.css";

export default function App() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { messages, streaming, activeTool, loadMessages, sendMessage } = useChat(activeId);

  const refreshSessions = useCallback(async () => {
    const data = await listSessions();
    setSessions(data);
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  async function handleNew() {
    const id = await createSession();
    await refreshSessions();
    setActiveId(id);
    loadMessages([]);
  }

  async function handleLoad(id: string) {
    setActiveId(id);
    const msgs = await getMessages(id);
    loadMessages(msgs);
  }

  async function handleDelete(id: string) {
    await deleteSession(id);
    if (id === activeId) {
      setActiveId(null);
      loadMessages([]);
    }
    await refreshSessions();
  }

  async function handleSend(text: string) {
    let id = activeId;
    if (!id) {
      id = await createSession();
      setActiveId(id);
      await refreshSessions();
    }
    await sendMessage(text);
    await refreshSessions();
  }

  return (
    <div className="layout">
      <SessionSidebar
        sessions={sessions}
        activeId={activeId}
        onNew={handleNew}
        onLoad={handleLoad}
        onDelete={handleDelete}
      />
      <main className="main">
        <header className="main-header">
          <span className="main-title">okcli</span>
          {activeId && <span className="session-id">{activeId}</span>}
        </header>
        <ChatWindow messages={messages} activeTool={activeTool} />
        <InputBar onSend={handleSend} disabled={streaming} />
      </main>
    </div>
  );
}
