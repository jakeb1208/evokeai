import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

const worlds = [
  {
    id: 'mosslight',
    title: 'Mosslight Station',
    note: 'A train station that only appears when you miss someone.',
    color: 'green',
  },
  {
    id: 'hidden-garden',
    title: 'The Hidden Garden',
    note: 'A quiet place where old memories grow new leaves.',
    color: 'purple',
  },
  {
    id: 'after-rain',
    title: 'After the Rain',
    note: 'A small town waiting for the next story to begin.',
    color: 'gold',
  },
];

function Wordmark() {
  return <span className="page-wordmark">evoke ai</span>;
}

function BackHome() {
  const [, setLocation] = useLocation();

  return (
    <button
      className="page-back"
      type="button"
      onClick={() => setLocation('/')}
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
  description: string;
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
          <p className="evoke-page-description">{description}</p>
        </header>
        {children}
      </div>
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
    {
      number: '01',
      title: 'Describe',
      copy: 'Start with a product, place, goal, memory, or feeling. There is no perfect prompt.',
    },
    {
      number: '02',
      title: 'Shape',
      copy: 'Add text, images, or video. EvoAI asks questions that help the idea become more itself.',
    },
    {
      number: '03',
      title: 'Reinforce',
      copy: 'Keep returning to the world. Each detail gives it more meaning and gives you more to remember.',
    },
  ];

  return (
    <PageFrame
      eyebrow="how it works"
      title="Turn a thought into a world."
      description="EvoAI helps you describe an idea, shape it with AI, and step inside when it is ready."
    >
      <section className="step-list" aria-label="How EvoAI works">
        {steps.map((step) => (
          <article className="step-row" key={step.number}>
            <span className="step-number">{step.number}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.copy}</p>
            </div>
          </article>
        ))}
      </section>
      <button
        className="evoke-button evoke-button-small page-action"
        type="button"
        onClick={() => setLocation('/edit-create')}
      >
        Try Edit / Create <span aria-hidden="true">→</span>
      </button>
    </PageFrame>
  );
}

function EditCreate() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [uploaded, setUploaded] = useState(false);
  const [asked, setAsked] = useState(false);

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
          <div className="studio-content">
            <div className="studio-copy">
              <span className="panel-label">edit an existing world</span>
              <h2>Upload something to change what is already there.</h2>
              <p>
                Add text, an image, or a video. EvoAI uses it to make thoughtful
                changes without losing the original feeling.
              </p>
              <button
                className="evoke-button evoke-button-small"
                type="button"
                onClick={() => setUploaded(true)}
              >
                {uploaded ? 'Ready to edit' : 'Upload text / image / video'}
              </button>
            </div>
            <div className="upload-placeholder" aria-label="Upload preview">
              <span className="upload-plus" aria-hidden="true">
                +
              </span>
              <span>{uploaded ? 'Your idea is ready' : 'Upload here'}</span>
              <small>{uploaded ? 'EvoAI can start shaping it.' : 'Drop a file or choose one.'}</small>
            </div>
          </div>
        ) : (
          <div className="studio-content">
            <div className="studio-copy">
              <span className="panel-label">create a new world</span>
              <h2>Let AI ask questions about what you imagine.</h2>
              <p>
                Begin with a sentence or a feeling. The questions help EvoAI
                understand the world you want to make.
              </p>
              <button
                className="evoke-button evoke-button-small"
                type="button"
                onClick={() => setAsked(true)}
              >
                {asked ? 'Questions are ready' : 'Ask EvoAI'}
              </button>
            </div>
            <div className="question-placeholder" aria-label="Create prompt preview">
              <span className="panel-label">your first question</span>
              <p>
                {asked
                  ? 'What should someone feel when they first arrive?'
                  : 'What would you like to make?'}
              </p>
              <span className="question-line" />
              <span className="question-line short" />
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
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const selected = worlds.find((world) => world.id === selectedWorld);

  if (selected) {
    return (
      <PageFrame
        eyebrow="immerse / view world"
        title={selected.title}
        description={selected.note}
      >
        <section className={`world-viewer ${selected.color}`} aria-label={`${selected.title} preview`}>
          <span className="panel-label">immersive preview</span>
          <div className="world-viewer-art">
            <span className="world-sun" />
            <span className="world-hill one" />
            <span className="world-hill two" />
            <span className="world-path" />
          </div>
          <div className="viewer-footer">
            <button
              className="text-action"
              type="button"
              onClick={() => setSelectedWorld(null)}
            >
              ← back to worlds
            </button>
            <button
              className="evoke-button evoke-button-small"
              type="button"
              onClick={() => setSelectedWorld(null)}
            >
              Leave world
            </button>
          </div>
        </section>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      eyebrow="immerse"
      title="Choose somewhere to go."
      description="View the worlds you have created and decide when you are ready to step inside."
    >
      <section className="world-list" aria-label="Created worlds">
        {worlds.map((world, index) => (
          <article className={`world-card ${world.color}`} key={world.id}>
            <div className="world-card-number">0{index + 1}</div>
            <div className="world-card-copy">
              <h2>{world.title}</h2>
              <p>{world.note}</p>
            </div>
            <button
              className="text-action"
              type="button"
              onClick={() => setSelectedWorld(world.id)}
            >
              View world <span aria-hidden="true">→</span>
            </button>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
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