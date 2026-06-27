import Link from "next/link";
import styles from "./home.module.css";

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/orders",
    description: "Create an order",
    post: true,
  },
  {
    method: "GET",
    path: "/api/orders?status=PENDING",
    description: "List orders by status",
  },
  {
    method: "GET",
    path: "/api/orders/{id}",
    description: "Order detail",
  },
  {
    method: "POST",
    path: "/api/orders/{id}/cancel",
    description: "Cancel when pending",
    post: true,
  },
] as const;

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Order processing</span>
          <h1 className={styles.title}>Intelligent Order Processing System</h1>
          <p className={styles.subtitle}>
            Create and track orders, run background processing, and handle
            cancellations through the REST API or support chat.
          </p>
        </header>

        <section className={styles.pipeline} aria-label="Order lifecycle">
          <span className={styles.pipelineLabel}>Lifecycle</span>
          <span className={`${styles.statusChip} ${styles.statusPending}`}>
            <span className={styles.statusDot} aria-hidden="true" />
            PENDING
          </span>
          <span className={styles.pipelineArrow} aria-hidden="true">
            →
          </span>
          <span className={`${styles.statusChip} ${styles.statusProcessing}`}>
            <span className={styles.statusDot} aria-hidden="true" />
            PROCESSING
          </span>
          <p className={styles.pipelineNote}>
            Background job every 5 minutes
          </p>
        </section>

        <div className={styles.grid}>
          <article className={`${styles.card} ${styles.cardPrimary}`}>
            <h2 className={styles.cardTitle}>Support chat</h2>
            <p className={styles.cardText}>
              Check order status, request cancellation for pending orders, and
              get answers from store policies.
            </p>
            <div className={styles.actions}>
              <Link href="/chat" className={styles.primaryLink}>
                Open chat
              </Link>
            </div>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>REST API</h2>
            <p className={styles.cardText}>
              Integrate with orders endpoints. Contract in{" "}
              <code>assets/swagger.json</code>.
            </p>
            <ul className={styles.endpoints}>
              {ENDPOINTS.map((endpoint) => (
                <li key={endpoint.path}>
                  <div className={styles.endpoint}>
                    <span
                      className={`${styles.method} ${endpoint.post ? styles.methodPost : ""}`}
                    >
                      {endpoint.method}
                    </span>
                    <span className={styles.path}>{endpoint.path}</span>
                  </div>
                  <span className={styles.endpointDesc}>
                    {endpoint.description}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <p className={styles.footer}>
          beecrowd / Winter senior fullstack assessment
        </p>
      </div>
    </main>
  );
}
