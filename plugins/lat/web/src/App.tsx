function App() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex h-screen">
        <aside className="w-64 border-r border-border bg-surface p-4">
          <h2 className="text-text-bright font-semibold text-sm uppercase tracking-wide">Sessions</h2>
        </aside>
        <main className="flex-1 p-6">
          <p className="text-text-muted">No responses yet.</p>
        </main>
      </div>
    </div>
  );
}

export default App;
