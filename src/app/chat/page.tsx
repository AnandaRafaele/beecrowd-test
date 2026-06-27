"use client";

import { useChat } from "ai/react";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./chat.module.css";

const SUGGESTIONS = [
  "What is my order status?",
  "I need to cancel my order",
  "What is your cancellation policy?",
];

export default function ChatPage() {
  const [orderId, setOrderId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setInput,
  } = useChat({
    api: "/api/chat",
    body: { orderId: orderId.trim() || undefined },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmit(event, {
      body: { orderId: orderId.trim() || undefined },
    });
  };

  const applySuggestion = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Order support</span>
          <h1 className={styles.title}>Support chat</h1>
          <p className={styles.subtitle}>
            Ask about order status or request cancellation for a pending order.
          </p>
        </header>

        <div className={styles.contextCard}>
          <label className={styles.contextLabel} htmlFor="orderId">
            Order ID
          </label>
          <input
            id="orderId"
            className={styles.contextInput}
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="550e8400-e29b-41d4-a716-446655440000"
            spellCheck={false}
            autoComplete="off"
          />
          <p className={styles.contextHint}>
            Optional. Links your message to a specific order for status and
            cancellation.
          </p>
        </div>

        <section className={styles.thread} aria-label="Chat conversation">
          <div className={styles.messages} aria-live="polite">
            {messages.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon} aria-hidden="true">
                  ◎
                </div>
                <p className={styles.emptyTitle}>Start a conversation</p>
                <p className={styles.emptyText}>
                  Add an order ID above, then ask a question or pick a prompt
                  below.
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className={styles.suggestion}
                      onClick={() => applySuggestion(text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <article
                    key={message.id}
                    className={`${styles.messageRow} ${
                      isUser ? styles.messageRowUser : styles.messageRowAssistant
                    }`}
                  >
                    <span className={styles.messageLabel}>
                      {isUser ? "You" : "Assistant"}
                    </span>
                    <div
                      className={`${styles.bubble} ${
                        isUser ? styles.bubbleUser : styles.bubbleAssistant
                      }`}
                    >
                      {message.content}
                    </div>
                  </article>
                );
              })
            )}

            {isLoading ? (
              <div className={styles.typing} aria-label="Assistant is typing">
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {error ? (
            <p className={styles.alert} role="alert">
              {error.message}
            </p>
          ) : null}

          <form className={styles.composer} onSubmit={onSubmit}>
            <div className={styles.composerRow}>
              <textarea
                ref={textareaRef}
                id="message"
                className={styles.textarea}
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message…"
                rows={1}
                required
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={isLoading || !input.trim()}
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
