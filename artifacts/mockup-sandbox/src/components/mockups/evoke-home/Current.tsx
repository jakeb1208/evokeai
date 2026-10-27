import './_group.css';

const steps = [
  { title: 'Describe', description: 'Put the first version of your idea into words.' },
  { title: 'Shape', description: 'Add detail, direction, and the pieces that make it yours.' },
  { title: 'Reinforce', description: 'Keep refining until the world feels ready to step into.' },
];
const setLocation = (_: string) => {};

export function Current() {
  return (
    <main className="evoke-home home-experience">
      <div className="evoke-glow evoke-glow-green" />
      <div className="evoke-glow evoke-glow-blue" />
      <header className="studio-nav">
        <button className="studio-nav-brand" type="button"><span className="brand-sigil" aria-hidden="true">e</span><span>evoke<span className="brand-ai">ai</span></span></button>
        <nav className="studio-nav-links">{['Edit', 'Create', 'Immerse', 'Music'].map((i) => <a key={i} className="studio-nav-link">{i}</a>)}</nav>
        <div className="studio-nav-end"><a className="nav-home-link">Home</a><button className="nav-signout" type="button">Sign out</button></div>
      </header>
      <section className="home-hero" aria-label="Evoke AI home">
        <div className="hero-art" aria-hidden="true" />
        <div className="hero-copy">
          <p className="hero-kicker"><span className="live-pulse" /> Your private creative universe <span className="kicker-line" /> 001 / ∞</p>
          <h1>Memories,<br /> <em>Reimagined</em></h1>
          <button className="hero-create" type="button" onClick={() => setLocation('/create')}>Create world <span aria-hidden="true">↗</span></button>
          <p className="hero-description">Your thoughts. Your images. A world you can actually step into. Give a memory dimension, then let your music follow you there.</p>
        </div>
        <div className="hero-bottom"><span>Imagine / Generate / Enter</span><a href="#the-process">Explore the process <span aria-hidden="true">↓</span></a></div>
      </section>
      <section className="home-process" id="the-process">
        <div className="home-process-inner">
          <div className="section-intro"><p className="evoke-eyebrow">01 / The process</p><h2>A thought is<br /><em>a place in waiting.</em></h2><p>There is no right way to begin. Start with a sentence, an image, or the feeling you can't quite name.</p></div>
          <div className="process-steps">
            {steps.map((step, index) => (
              <article className="process-step" key={index}><span className="process-index">0{index + 1} <span aria-hidden="true">↗</span></span><div><h3>{step.title}</h3><p>{step.description}</p></div></article>
            ))}
            <button className="process-more" type="button">See how it works <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </section>
      <section className="home-after">
        <div className="home-after-inner">
          <div className="after-visual"><div className="after-visual-label"><span>Evoke / World space</span><span>Your perspective, expanded</span></div></div>
          <div className="after-copy"><p className="evoke-eyebrow">02 / Go further</p><h2>Not just remembered.<br /><em>Relived.</em></h2><p>Return to the places you've made. Walk through them at your own pace. Add the sounds that make them yours.</p>
            <div className="after-actions"><button type="button">Enter your worlds <span aria-hidden="true">↗</span></button><button type="button">Open music library <span aria-hidden="true">↗</span></button></div>
          </div>
        </div>
      </section>
      <section className="home-closing"><p>The next world starts with you</p><h2>Make a place<br />of your own.</h2><button className="hero-create" type="button">Create world <span aria-hidden="true">↗</span></button></section>
      <footer className="home-footer"><span>evokeai</span><span>A private studio for what you imagine.</span><span>© 2025 Evoke AI</span></footer>
    </main>
  );
}
