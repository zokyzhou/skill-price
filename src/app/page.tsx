export default function Home() {
  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>skill-price API</h1>
      <p>POST <code>/api/skill-price</code> — estimate a fair market price for a Claude Code skill.</p>
      <pre>{JSON.stringify({
        content: "# skill markdown content...",
        installs: 340,
        active_30d: 120,
        rating: 4.2,
        category: "productivity",
        model: "claude-sonnet-4-6",
        uses_per_month: 1000
      }, null, 2)}</pre>
    </main>
  );
}
