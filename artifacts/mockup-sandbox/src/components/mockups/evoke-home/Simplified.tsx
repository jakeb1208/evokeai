import { useRef, type ReactNode } from 'react';
import './_simplified.css';

function Link({ href, className, children, ...rest }: { href: string; className?: string; children: ReactNode; [k: string]: unknown }) {
  return <a href={href} className={className} onClick={(e) => e.preventDefault()} {...rest}>{children}</a>;
}

const defaultSteps = [
  { title: 'Describe', description: 'Put the first version of your idea into words.' },
  { title: 'Shape', description: 'Add detail, direction, and the pieces that make it yours.' },
  { title: 'Reinforce', description: 'Keep refining until the world feels ready to step into.' },
];

function StudioNav({ overlay = false }: { overlay?: boolean }) {
  const location = '/home';
  const client = { auth: { signOut: async () => {} } };
  const setLocation = (_: string) => {};
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
    <header className={`studio-nav${overlay ? ' studio-nav-overlay' : ''}`}>
      <button className="studio-nav-brand" type="button" onClick={handleLogoClick} aria-label="evokeai, click five times quickly for editor" data-testid="button-wordmark">
        <span className="brand-sigil" aria-hidden="true">e</span><span>evoke<span className="brand-ai">ai</span></span>
      </button>
      <nav className="studio-nav-links" aria-label="Primary navigation">
        {(['edit', 'create', 'immerse', 'music'] as const).map((item) => (
          <Link key={item} href={`/${item}`} className={`studio-nav-link${location === `/${item}` || (item === 'immerse' && location.startsWith('/worlds/')) ? ' active' : ''}`} aria-current={location === `/${item}` ? 'page' : undefined} data-testid={`link-${item}`}>
            {item === 'immerse' ? 'Immerse' : item.charAt(0).toUpperCase() + item.slice(1)}
          </Link>
        ))}
      </nav>
      <div className="studio-nav-end">
        <Link href="/home" className="nav-home-link" aria-label="Home" data-testid="link-home">Home</Link>
        {client ? <button className="nav-signout" type="button" onClick={() => void client.auth.signOut()} data-testid="button-sign-out">Sign out</button> : null}
      </div>
    </header>
  );
}

export function Simplified() {
  const setLocation = (_: string) => {};
  const steps = defaultSteps;

  return (
    <main className="evoke-home home-experience">
      <StudioNav />
      <div className="simple-home">
        <section className="simple-home-intro" aria-labelledby="home-title">
          <p className="evoke-eyebrow">Evoke</p>
          <h1 id="home-title">Familiar places from old house photos.</h1>
          <p>Use family photos to create a place to look around together, then add personal music and talk about the memories it brings back.</p>
          <button className="simple-primary" type="button" onClick={() => setLocation('/create')} data-testid="button-create-world">Create a place</button>
        </section>
        <section className="simple-home-actions" aria-label="What you can do">
          <button type="button" className="simple-action" onClick={() => setLocation('/immerse')} data-testid="button-home-immerse"><strong>View saved places</strong><span>Open a place you already made.</span></button>
          <button type="button" className="simple-action" onClick={() => setLocation('/edit')} data-testid="button-home-edit"><strong>Edit a place</strong><span>Add photos or notes to an existing place.</span></button>
          <button type="button" className="simple-action" onClick={() => setLocation('/music')} data-testid="button-home-music"><strong>Music</strong><span>Upload and play personal songs.</span></button>
        </section>
        <section className="simple-home-steps" aria-labelledby="steps-title">
          <h2 id="steps-title">How it works</h2>
          <ol>
            {steps.map((step, index) => <li key={index}><strong>{step.title}</strong><span>{step.description}</span></li>)}
          </ol>
          <button className="simple-link" type="button" onClick={() => setLocation('/how-it-works')} data-testid="button-how-it-works">Read the full guide</button>
        </section>
      </div>
    </main>
  );
}

