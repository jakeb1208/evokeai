import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

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
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" name="email" type="email" autoComplete="email" />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" />
          </div>
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
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [prompt, setPrompt] = useState('');
  const [worldId, setWorldId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [files, setFiles] = useState<MarbleFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [operationState, setOperationState] = useState('ready');
  const [resultMessage, setResultMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const content = readContent();

  useEffect(() => {
    if (!operationId) return;

    let cancelled = false;
    const checkOperation = async () => {
      try {
        const response = await fetch(`/api/marble/operations/${encodeURIComponent(operationId)}`);
        const data = (await response.json()) as Record<string, unknown>;
        if (!response.ok) throw new Error(getApiError(data, 'Marble could not check this generation.'));
        if (cancelled) return;

        const state = getOperationState(data);
        setOperationState(state);
        if (isFinishedOperation(data, state)) {
          setOperationId(null);
          setResultMessage(
            state === 'succeeded'
              ? 'Your Marble world is ready in the World Labs response.'
              : `Marble finished with status: ${state}.`,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setOperationId(null);
          setErrorMessage(error instanceof Error ? error.message : 'Could not check Marble generation.');
        }
      }
    };

    void checkOperation();
    const intervalId = window.setInterval(() => void checkOperation(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [operationId]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > 8) {
      setErrorMessage('Choose no more than eight images.');
      return;
    }

    try {
      const encodedFiles = await Promise.all(selectedFiles.map(readMarbleFile));
      setFiles(encodedFiles);
      setErrorMessage('');
    } catch (error) {
      setFiles([]);
      setErrorMessage(error instanceof Error ? error.message : 'Could not read the selected images.');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setResultMessage('');

    if (mode === 'edit' && !worldId.trim()) {
      setErrorMessage('Add the Marble world ID you want to revise.');
      return;
    }
    if (!prompt.trim() && files.length === 0) {
      setErrorMessage('Add a description or at least one image.');
      return;
    }

    setIsSubmitting(true);
    setOperationState('starting');
    try {
      const response = await fetch('/api/marble/worlds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          worldId: worldId.trim() || undefined,
          displayName: displayName.trim() || undefined,
          files,
        }),
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(getApiError(data, 'Marble could not start generation.'));

      const nextOperationId = typeof data.operationId === 'string' ? data.operationId : null;
      setOperationId(nextOperationId);
      setOperationState(nextOperationId ? 'queued' : 'submitted');
      setResultMessage(
        nextOperationId
          ? 'Marble accepted the request. This page will check the operation every five seconds.'
          : 'Marble accepted the request, but did not return an operation ID.',
      );
    } catch (error) {
      setOperationState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not start Marble generation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageFrame
      eyebrow="edit / create"
      title={content.studio.title}
      description={content.studio.description}
    >
      <form className="studio-shell studio-form" aria-label="Edit and create workspace" onSubmit={handleSubmit}>
        <div className="mode-switch" role="tablist" aria-label="Edit or create">
          <button
            className={mode === 'edit' ? 'mode-button active' : 'mode-button'}
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            onClick={() => {
              setMode('edit');
              setErrorMessage('');
              setResultMessage('');
            }}
          >
            Edit
          </button>
          <button
            className={mode === 'create' ? 'mode-button active' : 'mode-button'}
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            onClick={() => {
              setMode('create');
              setErrorMessage('');
              setResultMessage('');
            }}
          >
            Create
          </button>
        </div>

        {mode === 'edit' ? (
          <div className="studio-content edit-world-content">
            <div className="studio-copy">
              <span className="panel-label">{content.studio.editLabel}</span>
              <h2>{content.studio.editTitle}</h2>
              <p>{content.studio.editDescription} Marble creates a new revision from the selected world.</p>
              <button className="evoke-button evoke-button-small" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Starting…' : 'Generate revision'} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="world-input-box" aria-label="Edit a world">
              <label className="panel-label" htmlFor="edit-world-id">
                marble world id
              </label>
              <input
                id="edit-world-id"
                className="studio-text-input"
                value={worldId}
                onChange={(event) => setWorldId(event.target.value)}
                placeholder="world_…"
              />
              <label className="panel-label" htmlFor="edit-text">
                {content.studio.textLabel}
              </label>
              <textarea
                id="edit-text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the changes you want to make…"
              />
              <label className="file-input-label" htmlFor="edit-files">
                <span className="upload-plus" aria-hidden="true">+</span>
                <span>{content.studio.filesLabel}</span>
                <small>Reference images · {files.length ? `${files.length} selected` : content.studio.filesHint}</small>
              </label>
              <input id="edit-files" type="file" accept="image/*" multiple onChange={handleFileChange} />
            </div>
          </div>
        ) : (
          <div className="studio-content">
            <div className="studio-copy">
              <span className="panel-label">{content.studio.createLabel}</span>
              <h2>{content.studio.createTitle}</h2>
              <p>{content.studio.createDescription}</p>
              <button className="evoke-button evoke-button-small" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Starting…' : 'Create world'} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="create-input-box" aria-label="Upload text and files">
              <label className="panel-label" htmlFor="create-name">
                world name
              </label>
              <input
                id="create-name"
                className="studio-text-input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="A name for this world"
              />
              <label className="panel-label" htmlFor="create-text">
                {content.studio.textLabel}
              </label>
              <textarea
                id="create-text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={content.studio.textPlaceholder}
              />
              <label className="file-input-label" htmlFor="create-files">
                <span className="upload-plus" aria-hidden="true">+</span>
                <span>{content.studio.filesLabel}</span>
                <small>Reference images · {files.length ? `${files.length} selected` : content.studio.filesHint}</small>
              </label>
              <input id="create-files" type="file" accept="image/*" multiple onChange={handleFileChange} />
            </div>
          </div>
        )}

        <div className="studio-footer">
          <span><span className="status-dot" /> Marble: {operationState}</span>
          {errorMessage ? <span className="studio-error" role="alert">{errorMessage}</span> : null}
          {resultMessage ? <span className="studio-result" role="status">{resultMessage}</span> : null}
        </div>
      </form>
    </PageFrame>
  );
}

type MarbleFile = {
  name: string;
  type: string;
  dataBase64: string;
};

const MAX_MARBLE_FILE_BYTES = 7_500_000;

function readMarbleFile(file: File): Promise<MarbleFile> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error(`${file.name} is not an image. Choose image files for Marble.`));
  }
  if (file.size > MAX_MARBLE_FILE_BYTES) {
    return Promise.reject(new Error(`${file.name} is larger than 7.5 MB. Choose a smaller image.`));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const dataBase64 = result.split(',', 2)[1];
      if (!dataBase64) {
        reject(new Error(`Could not encode ${file.name}.`));
        return;
      }
      resolve({ name: file.name, type: file.type, dataBase64 });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function getApiError(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === 'string' ? data.error : fallback;
}

function getOperationState(data: Record<string, unknown>) {
  const rawState = data.status ?? data.state ?? (data.done === true ? 'succeeded' : 'processing');
  return typeof rawState === 'string' ? rawState.toLowerCase() : 'processing';
}

function isFinishedOperation(data: Record<string, unknown>, state: string) {
  return data.done === true || ['succeeded', 'completed', 'failed', 'error', 'cancelled'].includes(state);
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
        <Route path="/admin" component={AdminEditor} />
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