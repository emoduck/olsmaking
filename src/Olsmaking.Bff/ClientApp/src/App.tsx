import './App.css'
import { InfoCard } from './components/InfoCard'
import { StatusBadge } from './components/StatusBadge'

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Olsmaking</p>
        <h1>Single-unit web app playground</h1>
        <p className="subtitle">
          React + TypeScript lives inside the .NET BFF as <code>ClientApp</code>, with local Storybook
          support for simple view components.
        </p>
        <div className="status-row">
          <StatusBadge label=".NET 10 LTS" tone="calm" />
          <StatusBadge label="Storybook local" tone="accent" />
          <StatusBadge label="Azure F1-first" tone="warning" />
        </div>
      </section>

      <section className="card-grid">
        <InfoCard
          title="BFF Host"
          subtitle="ASP.NET Core Web API serves API endpoints and static frontend assets as one deployable unit."
          footer="Ready for App Service deployment"
        />
        <InfoCard
          title="Component Workflow"
          subtitle="Storybook stays local-only for now and focuses on view components, not containers."
          footer="See docs/adr/ADR-001 for publishing option"
        />
      </section>
    </main>
  )
}

export default App
