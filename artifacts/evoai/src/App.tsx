import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

type AuthContextValue = {
  client: typeof supabase;
  configured: boolean;
  loading: boolean;
  session: Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getSession']>>['data']['session'];
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ client: supabase, configured: Boolean(supabase), loading, session }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

type StepContent = {
  title: string;
  description: string;
};

type EvokeContent = {
  how: {
    title: string;
    steps: StepContent[];
    thoughtLabel: string;
    thoughtPlaceholder: string;
    actionLabel: string;
  };
  studio: {
    title: string;
    description: string;
    editLabel: string;
    editTitle: string;
    editDescription: string;
    createLabel: string;
    createTitle: string;
    createDescription: string;
    textLabel: string;
    textPlaceholder: string;
    filesLabel: string;
    filesHint: string;
  };
};

const contentStorageKey = 'evoke-ai-content';

const defaultContent: EvokeContent = {
  how: {
    title: 'Start with a thought.',
    steps: [
      { title: 'Describe', description: 'Put the first version of your idea into words.' },
      { title: 'Shape', description: 'Add detail, direction, and the pieces that make it yours.' },
      { title: 'Reinforce', description: 'Keep refining until the world feels ready to step into.' },
    ],
    thoughtLabel: 'your thought',
    thoughtPlaceholder: 'Type anything you want to become a world…',
    actionLabel: 'Start shaping',
  },
  studio: {
    title: 'Give your world a shape.',
    description: 'Change an existing world or start a new one. Choose a path and add the pieces that matter.',
    editLabel: 'edit an existing world',
    editTitle: 'Bring a world back to life.',
    editDescription: 'Add notes or files to an existing world and keep shaping what is already there.',
    createLabel: 'create a new world',
    createTitle: 'Start with what you have.',
    createDescription: 'Add a thought, story, or set of references and make something new.',
    textLabel: 'add text',
    textPlaceholder: 'Paste a thought, story, or set of notes…',
    filesLabel: 'add files',
    filesHint: 'Images, video, or documents',
  },
};

function readContent(): EvokeContent {
  if (typeof window === 'undefined') return defaultContent;

  try {
    const saved = window.localStorage.getItem(contentStorageKey);
    if (!saved) return defaultContent;
    const parsed = JSON.parse(saved) as Partial<EvokeContent>;
    return {
      ...defaultContent,
      ...parsed,
      how: { ...defaultContent.how, ...parsed.how },
      studio: { ...defaultContent.studio, ...parsed.studio },
    };
  } catch {
    return defaultContent;
  }
}

function saveContent(content: EvokeContent) {
  window.localStorage.setItem(contentStorageKey, JSON.stringify(content));
}

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
  const { client, configured, session } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMessage, setAuthMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="evoke-home evoke-login">
      <div className="evoke-glow evoke-glow-green" />
      <div className="evoke-glow evoke-glow-purple" />
      <div className="evoke-grid" />

      <section className="login-card" aria-label="Log in to Evoke AI">
        <Wordmark />
        <div className="login-heading">
          <p className="evoke-eyebrow">welcome back</p>
          <h1>{authMode === 'login' ? 'Step into your worlds.' : 'Create your first world.'}</h1>
        </div>
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!client) {
              setAuthMessage('Supabase is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Railway.');
              return;
            }

            const formData = new FormData(event.currentTarget);
            const email = String(formData.get('email') ?? '').trim();
            const password = String(formData.get('password') ?? '');

            setSubmitting(true);
            setAuthMessage('');
            const result =
              authMode === 'login'
                ? await client.auth.signInWithPassword({ email, password })
                : await client.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: `${window.location.origin}/home` },
                  });
            setSubmitting(false);

            if (result.error) {
              setAuthMessage(result.error.message);
              return;
            }

            if (authMode === 'signup' && !result.data.session) {
              setAuthMessage('Account created. Check your email to confirm your account, then log in.');
              return;
            }

            setLocation('/home');
          }}
        >
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              minLength={6}
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          <button className="evoke-button login-button" type="submit">
            {submitting ? 'Working…' : authMode === 'login' ? 'Log in' : 'Create account'}{' '}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        {authMessage ? <p className="auth-message">{authMessage}</p> : null}
        {!configured ? (
          <p className="auth-setup-note">
            Railway setup needed: add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        ) : null}
        {session ? (
          <button className="auth-mode-toggle" type="button" onClick={() => setLocation('/home')}>
            Continue to Evoke AI
          </button>
        ) : (
          <button
            className="auth-mode-toggle"
            type="button"
            onClick={() => {
              setAuthMode((current) => (current === 'login' ? 'signup' : 'login'));
              setAuthMessage('');
            }}
          >
            {authMode === 'login' ? 'Need an account? Create one' : 'Already have an account? Log in'}
          </button>
        )}
      </section>
    </main>
  );
}

function Home() {
  const [, setLocation] = useLocation();
  const { client } = useAuth();
  const logoClicks = useRef<number[]>([]);

  const handleLogoClick = () => {
    const now = Date.now();
    logoClicks.current = [...logoClicks.current.filter((timestamp) => now - timestamp < 900), now];
    if (logoClicks.current.length >= 5) {
      logoClicks.current = [];
      setLocation('/admin');
    }
  };

  return (
    <main className="evoke-home">
      <div className="evoke-glow evoke-glow-green" />
      <div className="evoke-glow evoke-glow-purple" />
      <div className="evoke-grid" />

      <section className="evoke-card" aria-label="Evoke AI home">
        <button
          className="evoke-wordmark"
          type="button"
          onClick={handleLogoClick}
          aria-label="Evoke AI. Click five times quickly to open the admin editor."
        >
          evoke ai
        </button>
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
        {client ? (
          <button className="auth-signout" type="button" onClick={() => void client.auth.signOut()}>
            Sign out
          </button>
        ) : null}
      </section>
    </main>
  );
}

function HowItWorks() {
  const [, setLocation] = useLocation();
  const content = readContent();

  return (
    <PageFrame
      eyebrow="how it works"
      title={content.how.title}
    >
      <section className="step-list" aria-label="How EvoAI works">
        {content.how.steps.map((step, index) => (
          <article className="step-row" key={step.title + index}>
            <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="how-input-card" aria-label="Describe an idea">
        <label className="panel-label" htmlFor="world-thought">
          {content.how.thoughtLabel}
        </label>
        <textarea id="world-thought" placeholder={content.how.thoughtPlaceholder} />
        <button className="evoke-button evoke-button-small" type="button" onClick={() => setLocation('/edit-create')}>
          {content.how.actionLabel} <span aria-hidden="true">→</span>
        </button>
      </section>
    </PageFrame>
  );
}

function EditCreate() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [created, setCreated] = useState(false);
  const content = readContent();

  return (
    <PageFrame
      eyebrow="edit / create"
      title={content.studio.title}
      description={content.studio.description}
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
              <span className="panel-label">{content.studio.editLabel}</span>
              <h2>{content.studio.editTitle}</h2>
              <p>{content.studio.editDescription}</p>
              <button className="evoke-button evoke-button-small" type="button" onClick={() => setMode('create')}>
                Create a world <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="world-input-box" aria-label="Edit a world">
              <label className="panel-label" htmlFor="edit-text">
                {content.studio.textLabel}
              </label>
              <textarea id="edit-text" placeholder="Add a note about the world you want to change…" />
              <label className="file-input-label" htmlFor="edit-files">
                <span className="upload-plus" aria-hidden="true">+</span>
                <span>{content.studio.filesLabel}</span>
                <small>{content.studio.filesHint}</small>
              </label>
              <input id="edit-files" type="file" multiple />
            </div>
          </div>
        ) : (
          <div className="studio-content">
            <div className="studio-copy">
              <span className="panel-label">{content.studio.createLabel}</span>
              <h2>{content.studio.createTitle}</h2>
              <p>{content.studio.createDescription}</p>
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
                {content.studio.textLabel}
              </label>
              <textarea id="create-text" placeholder={content.studio.textPlaceholder} />
              <label className="file-input-label" htmlFor="create-files">
                <span className="upload-plus" aria-hidden="true">+</span>
                <span>{content.studio.filesLabel}</span>
                <small>{content.studio.filesHint}</small>
              </label>
              <input id="create-files" type="file" multiple />
            </div>
          </div>
        )}

        <div className="studio-footer">
          <span>
            <span className="status-dot" /> draft world
          </span>
        </div>
      </section>
    </PageFrame>
  );
}

function AdminEditor() {
  const [, setLocation] = useLocation();
  const [content, setContent] = useState<EvokeContent>(readContent);
  const [saved, setSaved] = useState(false);

  const updateHow = <K extends keyof EvokeContent['how']>(key: K, value: EvokeContent['how'][K]) => {
    setContent((current) => ({ ...current, how: { ...current.how, [key]: value } }));
    setSaved(false);
  };

  const updateStudio = <K extends keyof EvokeContent['studio']>(
    key: K,
    value: EvokeContent['studio'][K],
  ) => {
    setContent((current) => ({ ...current, studio: { ...current.studio, [key]: value } }));
    setSaved(false);
  };

  const updateStep = (index: number, key: keyof StepContent, value: string) => {
    setContent((current) => ({
      ...current,
      how: {
        ...current.how,
        steps: current.how.steps.map((step, stepIndex) =>
          stepIndex === index ? { ...step, [key]: value } : step,
        ),
      },
    }));
    setSaved(false);
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveContent(content);
    setSaved(true);
  };

  return (
    <PageFrame
      eyebrow="admin editor"
      title="Shape the experience."
      description="Update the words visitors see across How It Works and Edit / Create. Changes are saved in this browser for now."
    >
      <form className="admin-editor" onSubmit={handleSave}>
        <fieldset className="editor-section">
          <legend>How It Works</legend>
          <label className="editor-field">
            <span className="panel-label">page title</span>
            <input value={content.how.title} onChange={(event) => updateHow('title', event.target.value)} />
          </label>
          <div className="editor-step-grid">
            {content.how.steps.map((step, index) => (
              <div className="editor-step" key={index}>
                <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
                <label className="editor-field">
                  <span className="panel-label">step title</span>
                  <input value={step.title} onChange={(event) => updateStep(index, 'title', event.target.value)} />
                </label>
                <label className="editor-field">
                  <span className="panel-label">step text</span>
                  <textarea
                    value={step.description}
                    onChange={(event) => updateStep(index, 'description', event.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="editor-two-column">
            <label className="editor-field">
              <span className="panel-label">thought label</span>
              <input
                value={content.how.thoughtLabel}
                onChange={(event) => updateHow('thoughtLabel', event.target.value)}
              />
            </label>
            <label className="editor-field">
              <span className="panel-label">action label</span>
              <input
                value={content.how.actionLabel}
                onChange={(event) => updateHow('actionLabel', event.target.value)}
              />
            </label>
          </div>
          <label className="editor-field">
            <span className="panel-label">thought placeholder</span>
            <textarea
              value={content.how.thoughtPlaceholder}
              onChange={(event) => updateHow('thoughtPlaceholder', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="editor-section">
          <legend>Edit / Create</legend>
          <label className="editor-field">
            <span className="panel-label">page title</span>
            <input value={content.studio.title} onChange={(event) => updateStudio('title', event.target.value)} />
          </label>
          <label className="editor-field">
            <span className="panel-label">page description</span>
            <textarea
              value={content.studio.description}
              onChange={(event) => updateStudio('description', event.target.value)}
            />
          </label>
          <div className="editor-two-column">
            <div className="editor-panel">
              <span className="panel-label">edit tab</span>
              <label className="editor-field">
                <span className="sr-only">Edit tab label</span>
                <input value={content.studio.editLabel} onChange={(event) => updateStudio('editLabel', event.target.value)} />
              </label>
              <label className="editor-field">
                <span className="sr-only">Edit tab title</span>
                <input value={content.studio.editTitle} onChange={(event) => updateStudio('editTitle', event.target.value)} />
              </label>
              <label className="editor-field">
                <span className="sr-only">Edit tab text</span>
                <textarea
                  value={content.studio.editDescription}
                  onChange={(event) => updateStudio('editDescription', event.target.value)}
                />
              </label>
            </div>
            <div className="editor-panel">
              <span className="panel-label">create tab</span>
              <label className="editor-field">
                <span className="sr-only">Create tab label</span>
                <input value={content.studio.createLabel} onChange={(event) => updateStudio('createLabel', event.target.value)} />
              </label>
              <label className="editor-field">
                <span className="sr-only">Create tab title</span>
                <input value={content.studio.createTitle} onChange={(event) => updateStudio('createTitle', event.target.value)} />
              </label>
              <label className="editor-field">
                <span className="sr-only">Create tab text</span>
                <textarea
                  value={content.studio.createDescription}
                  onChange={(event) => updateStudio('createDescription', event.target.value)}
                />
              </label>
            </div>
          </div>
        </fieldset>

        <div className="admin-actions">
          <button className="evoke-button evoke-button-small" type="submit">
            {saved ? 'Saved' : 'Save changes'}
          </button>
          <button className="text-action" type="button" onClick={() => setLocation('/home')}>
            Back to home <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </PageFrame>
  );
}

function AuthRequired({ children }: { children: ReactNode }) {
  const { configured, loading, session } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && (!configured || !session)) setLocation('/login');
  }, [configured, loading, session, setLocation]);

  if (loading) {
    return (
      <main className="evoke-home auth-loading">
        <p className="evoke-eyebrow">checking your session…</p>
      </main>
    );
  }

  if (!configured || !session) return null;
  return children;
}

function ProtectedHome() {
  return (
    <AuthRequired>
      <Home />
    </AuthRequired>
  );
}

function ProtectedHowItWorks() {
  return (
    <AuthRequired>
      <HowItWorks />
    </AuthRequired>
  );
}

function ProtectedEditCreate() {
  return (
    <AuthRequired>
      <EditCreate />
    </AuthRequired>
  );
}

function ProtectedImmerse() {
  return (
    <AuthRequired>
      <Immerse />
    </AuthRequired>
  );
}

function ProtectedAdminEditor() {
  return (
    <AuthRequired>
      <AdminEditor />
    </AuthRequired>
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
        <Route path="/home" component={ProtectedHome} />
        <Route path="/how-it-works" component={ProtectedHowItWorks} />
        <Route path="/edit-create" component={ProtectedEditCreate} />
        <Route path="/immerse" component={ProtectedImmerse} />
        <Route path="/admin" component={ProtectedAdminEditor} />
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
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;