import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

function Wordmark() {
  return <span className="page-wordmark">evoke ai</span>;
}

function BackHome() {
  const [, setLocation] = useLocation();

  return (
    <button
      className="page-back"
      type="button"
      onClick={() => setLocation('/home')}
      aria-label="Back to home"
    >
      <span aria-hidden="true">←</span> home
    </button>
  );
}

function PageFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="evoke-page">
      <div className="evoke-glow evoke-glow-green" />
      <div className="evoke-glow evoke-glow-purple" />
      <div className="evoke-grid" />
      <div className="evoke-page-inner">
        <BackHome />
        <header className="evoke-page-header">
          <Wordmark />
          <p className="evoke-eyebrow">{eyebrow}</p>
          <h1 className="evoke-page-title">{title}</h1>
          {description ? <p className="evoke-page-description">{description}</p> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

function Login() {
  const [, setLocation] = useLocation();

  return (
    <main className="evoke-home evoke-login">
      <div className="evoke-glow evoke-glow-green" />
      <div className="evoke-glow evoke-glow-purple" />
      <div className="evoke-grid" />

      <section className="login-card" aria-label="Log in to Evoke AI">
        <Wordmark />
        <div className="login-heading">
          <p className="evoke-eyebrow">welcome back</p>
          <h1>Step into your worlds.</h1>
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            setLocation('/home');
          }}
        >
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="email" />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" />
          <button className="evoke-button login-button" type="submit">
            Log in <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  );
}

function Home() {
  const [, setLocation] = useLocation();

  return (
    <main className="evoke-home">
      <div className="evoke-glow evoke-glow-green" />
      <div className="evoke-glow evoke-glow-purple" />
      <div className="evoke-grid" />

      <section className="evoke-card" aria-label="Evoke AI home">
        <h1 className="evoke-wordmark">evoke ai</h1>
        <div className="evoke-actions">
          <button
            className="evoke-button"
            type="button"
            onClick={() => setLocation('/how-it-works')}
          >
            How it works
          </button>
          <button
            className="evoke-button"
            type="button"
            onClick={() => setLocation('/edit-create')}
          >
            Edit / Create
          </button>
          <button
            className="evoke-button"
            type="button"
            onClick={() => setLocation('/immerse')}
          >
            Immerse
          </button>
        </div>
      </section>
    </main>
  );
}

function HowItWorks() {
  const [, setLocation] = useLocation();
  const steps = [
    { number: '01', title: 'Describe' },
    { number: '02', title: 'Shape' },
    { number: '03', title: 'Reinforce' },
  ];

  return (
    <PageFrame
      eyebrow="how it works"
      title="Start with a thought."
    >
      <section className="step-list" aria-label="How EvoAI works">
        {steps.map((step) => (
          <article className="step-row" key={step.number}>
            <span className="step-number">{step.number}</span>
            <h2>{step.title}</h2>
          </article>
        ))}
      </section>
      <section className="how-input-card" aria-label="Describe an idea">
        <label className="panel-label" htmlFor="world-thought">
          your thought
        </label>
        <textarea id="world-thought" placeholder="Type anything you want to become a world…" />
        <button className="evoke-button evoke-button-small" type="button" onClick={() => setLocation('/edit-create')}>
          Start shaping <span aria-hidden="true">→</span>
        </button>
      </section>
    </PageFrame>
  );
}

function EditCreate() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [created, setCreated] = useState(false);

  return (
    <PageFrame
      eyebrow="edit / create"
      title="Give your world a shape."
      description="Change an existing world or start a new one. This screen follows the two paths from your design tree."
    >
      <section className="studio-shell" aria-label="Edit and create workspace">
        <div className="mode-switch" role="tablist" aria-label="Edit or create">
          <button
            className={mode === 'edit' ? 'mode-button active' : 'mode-button'}
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
          <button
            className={mode === 'create' ? 'mode-button active' : 'mode-button'}
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            onClick={() => setMode('create')}
          >
            Create
          </button>
        </div>

        {mode === 'edit' ? (
          <div className="studio-content edit-world-content">
            <div className="studio-copy">
              <span className="panel-label">edit an existing world</span>
              <h2>Choose a world.</h2>
              <p>No worlds yet. Create one first, then it will appear here.</p>
              <button className="evoke-button evoke-button-small" type="button" onClick={() => setMode('create')}>
                Create a world <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="choose-world-box" aria-label="Choose a world">
              <span className="upload-plus" aria-hidden="true">+</span>
              <label htmlFor="edit-world">choose world</label>
              <select id="edit-world" disabled defaultValue="">
                <option value="" disabled>
                  No worlds available
                </option>
              </select>
            </div>
          </div>
        ) : (
          <div className="studio-content">
            <div className="studio-copy">
              <span className="panel-label">create a new world</span>
              <h2>Upload text and files.</h2>
              <p>Give EvoAI the pieces of your idea and shape something new.</p>
              <button
                className="evoke-button evoke-button-small"
                type="button"
                onClick={() => setCreated(true)}
              >
                {created ? 'World draft ready' : 'Create world'}
              </button>
            </div>
            <div className="create-input-box" aria-label="Upload text and files">
              <label className="panel-label" htmlFor="create-text">
                upload text
              </label>
              <textarea id="create-text" placeholder="Paste a thought, story, or set of notes…" />
              <label className="file-input-label" htmlFor="create-files">
                <span className="upload-plus" aria-hidden="true">+</span>
                <span>add files</span>
                <small>Images, video, or documents</small>
              </label>
              <input id="create-files" type="file" multiple />
            </div>
          </div>
        )}

        <div className="studio-footer">
          <span>
            <span className="status-dot" /> draft world
          </span>
          <button
            className="text-action"
            type="button"
            onClick={() => setLocation('/immerse')}
          >
            View world <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </PageFrame>
  );
}

function Immerse() {
  return (
    <PageFrame
      eyebrow="immerse"
      title="Choose a world."
    >
      <section className="world-list empty-world-list" aria-label="World slots">
        <div className="empty-world-grid">
          <div className="empty-world-slot" />
          <div className="empty-world-slot" />
          <div className="empty-world-slot" />
        </div>
      </section>
    </PageFrame>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/home" component={Home} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/edit-create" component={EditCreate} />
        <Route path="/immerse" component={Immerse} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;