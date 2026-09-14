import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

const destinations = ['How it works', 'Edit / Create', 'Immerse'];

function Home() {
  return (
    <main className="evoke-home">
      <div className="evoke-glow evoke-glow-green" />
      <div className="evoke-glow evoke-glow-purple" />
      <div className="evoke-grid" />

      <section className="evoke-card" aria-label="Evoke AI home">
        <h1 className="evoke-wordmark">evoke ai</h1>
        <div className="evoke-actions">
          {destinations.map((destination) => (
            <button
              key={destination}
              className="evoke-button"
              type="button"
              aria-label={destination}
            >
              {destination}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
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