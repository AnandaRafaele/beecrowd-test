"use client";

import { useChat } from "ai/react";
import { FormEvent, useState } from "react";

export default function ChatPage() {
  const [orderId, setOrderId] = useState("");
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: "/api/chat",
      body: { orderId: orderId.trim() || undefined },
    });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmit(event, {
      body: { orderId: orderId.trim() || undefined },
    });
  };

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Order Support Chat</h1>
      <p>Ask about order status or request cancellation for a pending order.</p>

      <label htmlFor="orderId" style={{ display: "block", marginBottom: "1rem" }}>
        Order ID (optional)
        <input
          id="orderId"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          placeholder="550e8400-e29b-41d4-a716-446655440000"
          style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
        />
      </label>

      <section
        aria-live="polite"
        style={{
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: "1rem",
          minHeight: 240,
          marginBottom: "1rem",
        }}
      >
        {messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          messages.map((message) => (
            <article key={message.id} style={{ marginBottom: "0.75rem" }}>
              <strong>{message.role}:</strong> {message.content}
            </article>
          ))
        )}
        {isLoading ? <p>Assistant is typing…</p> : null}
        {error ? <p role="alert">Error: {error.message}</p> : null}
      </section>

      <form onSubmit={onSubmit}>
        <label htmlFor="message" style={{ display: "block", marginBottom: "0.5rem" }}>
          Message
          <textarea
            id="message"
            value={input}
            onChange={handleInputChange}
            rows={3}
            required
            style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
          />
        </label>
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </main>
  );
}
