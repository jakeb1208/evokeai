import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  Copy,
  Crown,
  Eye,
  Feather,
  Globe2,
  ImagePlus,
  Layers3,
  Menu,
  MousePointer2,
  MoveUpRight,
  Play,
  Plus,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type IconType = typeof Sparkles;

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'studio', label: 'Edit / Create' },
  { id: 'immerse', label: 'Immerse' },
];

const pathways: { number: string; title: string; detail: string; icon: IconType; color: string; target: string }[] = [
  {
    number: '01',
    title: 'Make a world',
    detail: 'Start with a feeling, a fragment, or a question. EvoAI gives it somewhere to grow.',
    icon: Wand2,
    color: 'bg-[#d8efc5]',
    target: 'studio',
  },
  {
    number: '02',
    title: 'Shape the strange',
    detail: 'Add images, voice, and notes. Keep the beautiful accidents. Move the rest around.',
    icon: Feather,
    color: 'bg-[#eee1fb]',
    target: 'studio',
  },
  {
    number: '03',
    title: 'Step inside',
    detail: 'Leave the canvas behind. Wander through the places and memories you made.',
    icon: Eye,
    color: 'bg-[#ffe6a9]',
    target: 'immerse',
  },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function LogoMark() {
  return (
    <span className="relative flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#b8ed68] text-[#173f2b] shadow-[0_3px_0_#4f9d58]">
      <span className="font-display text-[19px] font-extrabold leading-none">e</span>
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#a47ddb]" />
    </span>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 px-4 pt-4 sm:px-7 lg:px-10">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between rounded-[22px] border border-[#244e39]/15 bg-[#f1f5d9]/85 px-4 py-3 shadow-[0_12px_38px_rgba(34,82,54,.08)] backdrop-blur-xl sm:px-5">
        <button
          data-testid="button-logo-home"
          onClick={() => scrollToSection('home')}
          className="group flex items-center gap-3"
          aria-label="EvoAI home"
        >
          <LogoMark />
          <span className="font-display text-xl font-extrabold tracking-[-.06em] text-[#173f2b]">EvoAI</span>
        </button>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              data-testid={`link-nav-${item.id}`}
              onClick={() => scrollToSection(item.id)}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#356247] transition-colors hover:bg-white/55 hover:text-[#173f2b]"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-enter-portal"
            onClick={() => scrollToSection('studio')}
            className="portal-button hidden rounded-full bg-[#246745] px-4 py-2.5 text-[13px] font-semibold text-[#f5f7df] sm:block"
          >
            Enter the portal <ArrowRight className="ml-1.5 inline h-3.5 w-3.5" />
          </button>
          <button
            data-testid="button-open-menu"
            onClick={onMenu}
            className="rounded-full p-2 text-[#1c5737] hover:bg-white/60 md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ close }: { close: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#173f2b]/35 backdrop-blur-sm md:hidden" role="dialog" aria-label="Navigation menu">
      <div className="absolute right-3 top-3 w-[min(92vw,350px)] rounded-[28px] bg-[#f3f5d9] p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#244e39]/10 pb-4">
          <div className="flex items-center gap-3"><LogoMark /><span className="font-display text-xl font-extrabold text-[#173f2b]">EvoAI</span></div>
          <button data-testid="button-close-menu" onClick={close} className="rounded-full p-2 text-[#173f2b] hover:bg-[#dce8bd]" aria-label="Close navigation menu"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-col gap-2 py-5">
          {navItems.map((item) => (
            <button
              key={item.id}
              data-testid={`link-mobile-nav-${item.id}`}
              onClick={() => { close(); scrollToSection(item.id); }}
              className="flex items-center justify-between rounded-2xl px-4 py-3 text-left font-semibold text-[#356247] hover:bg-white/65"
            >
              {item.label}<ArrowRight className="h-4 w-4" />
            </button>
          ))}
        </div>
        <button data-testid="button-mobile-enter" onClick={() => { close(); scrollToSection('studio'); }} className="portal-button w-full rounded-full bg-[#246745] px-4 py-3 text-sm font-semibold text-[#f5f7df]">Enter the portal</button>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="home" className="relative isolate overflow-hidden px-5 pb-24 pt-36 sm:px-8 lg:min-h-[850px] lg:px-12 lg:pb-28 lg:pt-44">
      <div className="absolute inset-0 -z-20 bg-[#f1f5d9]" />
      <div className="absolute -left-32 top-24 -z-10 h-[430px] w-[430px] rounded-full bg-[#a5e36f]/30 blur-3xl" />
      <div className="absolute right-[-8%] top-28 -z-10 h-[520px] w-[520px] rounded-full bg-[#bb92e8]/25 blur-3xl" />
      <div className="portal-grid absolute inset-x-0 bottom-0 -z-10 h-[48%] opacity-40 [mask-image:linear-gradient(to_bottom,transparent,black)]" />
      <div className="mx-auto grid max-w-[1380px] items-center gap-14 lg:grid-cols-[1.03fr_.97fr]">
        <div className="reveal max-w-[780px]">
          <div className="mb-6 flex items-center gap-3 font-mono-ui text-[10px] font-medium uppercase tracking-[.18em] text-[#467b58]">
            <span className="h-2 w-2 rounded-full bg-[#6ebc55] shadow-[0_0_0_4px_#d8efc5]" />
            A place for unfinished ideas
          </div>
          <h1 data-testid="text-hero-title" className="font-display text-[clamp(4.7rem,13vw,10.8rem)] font-extrabold leading-[.79] tracking-[-.095em] text-[#173f2b]">
            E<span className="relative inline-block">v<span className="absolute -right-[.05em] top-[.03em] h-[.15em] w-[.15em] rounded-full bg-[#9d6ed2]" /></span>oAI
          </h1>
          <p className="mt-9 max-w-[570px] text-balance text-[clamp(1.25rem,2.5vw,2rem)] leading-[1.14] tracking-[-.035em] text-[#356247]">
            Turn the faintest spark into somewhere you can actually go.
          </p>
          <p className="mt-5 max-w-[470px] text-base leading-7 text-[#52725c]">
            Create, edit, and step inside AI-generated worlds, memories, and ideas. EvoAI is a gentle push from “what if” to “there it is.”
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <button data-testid="button-start-creating" onClick={() => scrollToSection('studio')} className="portal-button rounded-full bg-[#246745] px-6 py-3.5 text-sm font-semibold text-[#f5f7df]">
              Start with a thought <ArrowDownRight className="ml-2 inline h-4 w-4" />
            </button>
            <button data-testid="button-see-how" onClick={() => scrollToSection('how-it-works')} className="portal-outline rounded-full border border-[#467b58]/35 bg-transparent px-6 py-3.5 text-sm font-semibold text-[#285b3d]">
              See how it works
            </button>
          </div>
          <div className="mt-12 flex items-center gap-3 text-xs text-[#52725c]">
            <div className="flex -space-x-2">
              {['#c7e89b', '#dbc8ef', '#f6c77b', '#9bd8ce'].map((color, index) => <span key={color} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f1f5d9] text-[9px] font-bold text-[#285b3d]" style={{ backgroundColor: color }}>{['M', 'S', 'A', 'J'][index]}</span>)}
            </div>
            <span>Made for people who collect little universes.</span>
          </div>
        </div>

        <div className="reveal reveal-delay-2 relative mx-auto min-h-[430px] w-full max-w-[610px] lg:min-h-[570px]">
          <div className="float-slower absolute right-[4%] top-[5%] h-16 w-16 rounded-[21px] border border-white/60 bg-[#d7b9f2] shadow-[0_18px_30px_rgba(76,46,108,.14)] lg:h-24 lg:w-24">
            <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[8px] border-2 border-[#825aa8] lg:h-9 lg:w-9" />
          </div>
          <div className="float-slow absolute bottom-[8%] left-[2%] h-20 w-20 rounded-[28px] border border-white/55 bg-[#f7cc78] shadow-[0_18px_30px_rgba(112,72,33,.13)] lg:h-28 lg:w-28">
            <Sparkles className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-[#9d6f2a] lg:h-11 lg:w-11" />
          </div>
          <div className="absolute left-[6%] top-[12%] h-[79%] w-[84%] rotate-[-5deg] rounded-[34px] border border-[#315f45]/20 bg-[#d7ebc5]/90 shadow-[0_35px_65px_rgba(40,84,55,.16)]" />
          <div className="absolute left-[10%] top-[7%] h-[79%] w-[84%] rotate-[4deg] rounded-[34px] border border-[#315f45]/15 bg-[#eee4f9]/90 shadow-[0_35px_65px_rgba(40,84,55,.16)]" />
          <div className="absolute left-[4%] top-[13%] h-[79%] w-[84%] overflow-hidden rounded-[34px] border border-white/70 bg-[#f4f6db] shadow-[0_30px_60px_rgba(40,84,55,.20)]">
            <div className="flex items-center justify-between border-b border-[#315f45]/15 px-5 py-4">
              <div className="flex items-center gap-2"><LogoMark /><span className="font-display text-lg font-bold tracking-[-.05em] text-[#24573a]">EvoAI</span></div>
              <span className="rounded-full bg-[#e2edcf] px-3 py-1 font-mono-ui text-[9px] uppercase tracking-widest text-[#4f7958]">your portal</span>
            </div>
            <div className="relative h-[calc(100%-63px)] overflow-hidden bg-[#dcecc9] p-5">
              <div className="absolute -right-12 top-3 h-44 w-44 rounded-full bg-[#c19ce4]/65 blur-2xl" />
              <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-[#b2e17a]/65 blur-2xl" />
              <div className="relative flex items-end justify-between">
                <div><p className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#608568]">world 004</p><p className="mt-2 font-display text-[28px] font-bold leading-[.95] tracking-[-.06em] text-[#24573a] lg:text-[39px]">Mosslight<br />Station</p></div>
                <span className="rounded-full bg-[#f5f6df]/70 p-2 text-[#6c5295]"><Globe2 className="h-4 w-4" /></span>
              </div>
              <div className="absolute bottom-5 left-5 right-5 top-[42%] rounded-[24px] border border-[#6b985f]/25 bg-[#bedda8]/65">
                <div className="absolute bottom-0 left-[17%] h-[66%] w-[22%] rounded-t-[100%] rounded-br-[10px] bg-[#66985c]" />
                <div className="absolute bottom-0 left-[32%] h-[49%] w-[32%] rounded-t-[100%] rounded-br-[10px] bg-[#77a966]" />
                <div className="absolute bottom-[12%] right-[17%] h-12 w-20 rotate-[-8deg] rounded-[50%] border-2 border-[#558655]/60 bg-[#d4e9ba]" />
                <div className="absolute left-[15%] top-[14%] h-2 w-2 rounded-full bg-[#f4d58d] shadow-[30px_18px_0_0_#f4d58d,75px_1px_0_0_#f4d58d,130px_22px_0_0_#f4d58d]" />
              </div>
              <div className="absolute bottom-5 right-5 flex items-center gap-2 rounded-full bg-[#f5f6df] px-3 py-2 text-[10px] font-semibold text-[#285b3d] shadow-md"><MousePointer2 className="h-3 w-3" /> step inside</div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-14 flex max-w-[1380px] items-center justify-between border-t border-[#315f45]/15 pt-5 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#618069] lg:mt-4">
        <span>01 — imagine / make / wander</span><span className="hidden sm:block">Scroll to explore <ChevronDown className="ml-1 inline h-3 w-3" /></span>
      </div>
    </section>
  );
}

function Pathways() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-[#e6efd1] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-[1380px]">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-24">
          <div>
            <span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#588463]">02 / The way in</span>
            <h2 className="mt-6 max-w-[500px] font-display text-5xl font-bold leading-[.95] tracking-[-.07em] text-[#173f2b] sm:text-7xl">Ideas are doors.<br /><span className="text-[#9970bf]">EvoAI is the key.</span></h2>
            <p className="mt-7 max-w-[400px] text-base leading-7 text-[#52725c]">No blank canvas staring contest. Follow your curiosity through a loose, living sequence that makes room for the unexpected.</p>
            <button data-testid="button-read-process" onClick={() => scrollToSection('studio')} className="portal-outline mt-8 rounded-full border border-[#467b58]/35 bg-transparent px-5 py-3 text-sm font-semibold text-[#285b3d]">Walk the path <ArrowRight className="ml-2 inline h-4 w-4" /></button>
          </div>
          <div className="divide-y divide-[#467b58]/20">
            {pathways.map((pathway) => {
              const Icon = pathway.icon;
              return (
                <button key={pathway.number} data-testid={`button-pathway-${pathway.number}`} onClick={() => scrollToSection(pathway.target)} className="group grid w-full grid-cols-[54px_1fr_auto] items-center gap-4 py-7 text-left transition-transform hover:translate-x-2 sm:grid-cols-[74px_1fr_auto]">
                  <span className="font-mono-ui text-xs text-[#729079]">{pathway.number}</span>
                  <span><span className="block font-display text-3xl font-bold tracking-[-.055em] text-[#24573a] sm:text-4xl">{pathway.title}</span><span className="mt-2 block max-w-[420px] text-sm leading-6 text-[#5c7b64]">{pathway.detail}</span></span>
                  <span className={`flex h-12 w-12 items-center justify-center rounded-[17px] ${pathway.color} text-[#285b3d] shadow-[0_4px_0_rgba(40,91,61,.12)] transition-transform group-hover:rotate-[-8deg] group-hover:scale-110`}><Icon className="h-5 w-5" /></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StudioPreview() {
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create');
  return (
    <section id="studio" className="scroll-mt-24 overflow-hidden bg-[#173f2b] px-5 py-24 text-[#f1f5d9] sm:px-8 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-[1380px]">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#a5d58a]">03 / Your studio</span><h2 className="mt-5 max-w-[760px] font-display text-5xl font-bold leading-[.9] tracking-[-.075em] sm:text-7xl">Make it yours.<br /><span className="text-[#bb92e8]">Then make it weirder.</span></h2></div>
          <p className="max-w-[310px] text-sm leading-6 text-[#b6d0af]">A calm place to put all the pieces. EvoAI listens for the thread running through them.</p>
        </div>
        <div className="mt-14 grid gap-8 lg:grid-cols-[.64fr_1.36fr]">
          <div className="relative overflow-hidden rounded-[30px] border border-[#9bc38f]/20 bg-[#24573a] p-7 sm:p-9">
            <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-[#9872c2]/25 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#a5d58a]">A small prompt</span><Sparkles className="h-4 w-4 text-[#f6c77b]" /></div>
              <p className="mt-12 font-display text-3xl font-semibold leading-[1.02] tracking-[-.055em] text-[#f3f4dc] sm:text-4xl">“A train station that only appears when you miss someone.”</p>
              <div className="mt-12 border-t border-[#9bc38f]/20 pt-5 text-xs leading-5 text-[#b6d0af]">Every world starts a little unfinished. That is the good part.</div>
            </div>
            <div className="relative mt-12 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#a5e36f]" /><span className="font-mono-ui text-[10px] text-[#a5d58a]">EvoAI is listening</span></div>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-[#9bc38f]/20 bg-[#edf1d7] text-[#173f2b] shadow-[0_25px_60px_rgba(0,0,0,.15)]">
            <div className="flex items-center justify-between border-b border-[#315f45]/15 px-5 py-4 sm:px-7">
              <div className="flex gap-1 rounded-full bg-[#dfeacb] p-1">
                {(['create', 'edit'] as const).map((tab) => <button key={tab} data-testid={`button-studio-tab-${tab}`} onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${activeTab === tab ? 'bg-[#246745] text-[#f1f5d9] shadow-sm' : 'text-[#598064] hover:text-[#285b3d]'}`}>{tab}</button>)}
              </div>
              <span className="font-mono-ui text-[10px] uppercase tracking-widest text-[#7a9a7d]">untitled world</span>
            </div>
            <div className="grid min-h-[360px] gap-6 p-5 sm:grid-cols-[1fr_1.12fr] sm:p-7">
              <div className="flex flex-col justify-between">
                <div>
                  <span className="font-mono-ui text-[10px] uppercase tracking-widest text-[#7a9a7d]">{activeTab === 'create' ? 'Build from a spark' : 'Change the atmosphere'}</span>
                  <h3 className="mt-4 font-display text-4xl font-bold leading-[.92] tracking-[-.07em] text-[#24573a]">{activeTab === 'create' ? 'What wants to exist?' : 'Give it another sky.'}</h3>
                  <p className="mt-4 text-sm leading-6 text-[#64806a]">{activeTab === 'create' ? 'Tell EvoAI what you are imagining. It will ask the kind of questions that open things up.' : 'Upload a note, image, or small memory. Nudge the world without losing its first feeling.'}</p>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {(activeTab === 'create' ? ['place', 'memory', 'story'] : ['image', 'voice note', 'sketch']).map((tag) => <span key={tag} className="rounded-full border border-[#82a37c]/30 px-3 py-1.5 text-[11px] text-[#4d7659]">{tag}</span>)}
                </div>
              </div>
              <div className="relative min-h-[260px] overflow-hidden rounded-[24px] bg-[#cfe4bb] p-5">
                <div className="absolute right-[-12%] top-[-20%] h-48 w-48 rounded-full bg-[#b38bd8]/55 blur-2xl" />
                <div className="absolute bottom-[-24%] left-[-10%] h-48 w-48 rounded-full bg-[#a0d76d]/70 blur-2xl" />
                <div className="relative flex items-center justify-between"><span className="rounded-full bg-[#f0f4db]/80 px-3 py-1 font-mono-ui text-[9px] text-[#52765a]">draft / 01</span><Copy className="h-4 w-4 text-[#52765a]" /></div>
                <div className="absolute bottom-7 left-5 right-5 rounded-[18px] bg-[#f0f4db]/85 p-4 shadow-sm"><p className="font-display text-2xl font-bold leading-none tracking-[-.05em] text-[#24573a]">The platform<br />between places</p><div className="mt-4 h-1.5 w-2/3 rounded-full bg-[#9fc27e]" /><div className="mt-2 h-1.5 w-1/2 rounded-full bg-[#b5d398]" /></div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#315f45]/15 px-5 py-4 sm:px-7"><span className="flex items-center gap-2 text-xs text-[#63806b]"><span className="h-2 w-2 rounded-full bg-[#71b657]" /> Autosaved just now</span><button data-testid="button-open-studio" onClick={() => scrollToSection('immerse')} className="portal-button rounded-full bg-[#246745] px-4 py-2.5 text-xs font-semibold text-[#f1f5d9]">View your world <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Immerse() {
  return (
    <section id="immerse" className="scroll-mt-24 bg-[#f1f5d9] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-[1380px]">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[#588463]">04 / Leave the desk behind</span><h2 className="mt-5 max-w-[750px] font-display text-5xl font-bold leading-[.88] tracking-[-.075em] text-[#173f2b] sm:text-8xl">A world is better<br /><span className="text-[#9970bf]">when you can wander it.</span></h2></div>
          <div className="max-w-[250px] pb-2 text-sm leading-6 text-[#52725c]">View the thread. Follow the light. Notice what your idea was trying to say.</div>
        </div>
        <div className="relative mt-16 overflow-hidden rounded-[34px] border border-[#315f45]/15 bg-[#cfe4bb] shadow-[0_25px_60px_rgba(40,84,55,.14)]">
          <div className="portal-grid absolute inset-0 opacity-25" />
          <div className="relative grid min-h-[550px] items-end lg:grid-cols-[.62fr_1.38fr]">
            <div className="z-10 p-7 sm:p-12 lg:p-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#315f45]/20 bg-[#edf1d7]/65 px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wider text-[#4d7659]"><span className="h-1.5 w-1.5 rounded-full bg-[#75bd5c]" /> World 004 / Mosslight Station</span>
              <h3 className="mt-8 max-w-[390px] font-display text-5xl font-bold leading-[.85] tracking-[-.08em] text-[#24573a] sm:text-7xl">Somewhere<br />to wait<br /><span className="text-[#6e4b95]">for wonder.</span></h3>
              <p className="mt-7 max-w-[300px] text-sm leading-6 text-[#52725c]">Your memories become landmarks. Your questions become paths. The rest reveals itself as you move.</p>
              <button data-testid="button-enter-mosslight" onClick={() => scrollToSection('home')} className="portal-button mt-8 rounded-full bg-[#f1f5d9] px-5 py-3 text-sm font-semibold text-[#285b3d]">Enter Mosslight <MoveUpRight className="ml-1.5 inline h-4 w-4" /></button>
            </div>
            <div className="relative min-h-[370px] self-stretch overflow-hidden lg:min-h-[550px]">
              <div className="absolute right-[11%] top-[12%] h-36 w-36 rounded-full bg-[#d8b8f0]/60 blur-2xl sm:h-60 sm:w-60" />
              <div className="absolute bottom-[-12%] left-[19%] h-[50%] w-[30%] rounded-t-[100%] bg-[#78a965]" />
              <div className="absolute bottom-[-16%] left-[46%] h-[68%] w-[38%] rounded-t-[100%] bg-[#609354]" />
              <div className="absolute bottom-[20%] left-[48%] h-[24%] w-[22%] rounded-[50%] border-[10px] border-[#d9ecbe] bg-[#aacb90] shadow-[0_0_0_3px_#5c8c54]" />
              <div className="absolute bottom-[19%] right-[10%] h-1/2 w-[16%] rounded-t-full bg-[#4f824e]" />
              <div className="absolute left-[18%] top-[19%] h-2 w-2 rounded-full bg-[#fff0af] shadow-[45px_45px_0_1px_#fff0af,130px_12px_0_0_#fff0af,190px_72px_0_1px_#fff0af,260px_22px_0_0_#fff0af]" />
              <div className="absolute bottom-7 left-7 right-7 flex items-center justify-between font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#4c7654]"><span>quiet hours / 02:17</span><span>sound on</span></div>
              <div className="absolute right-7 top-7 flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f5d9]/80 text-[#285b3d] shadow-lg"><Play className="ml-0.5 h-4 w-4 fill-current" /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#eee1fb] px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
      <div className="absolute -left-20 bottom-[-160px] h-[420px] w-[420px] rounded-full bg-[#b8ed68]/50 blur-3xl" />
      <div className="absolute -right-10 top-[-120px] h-[390px] w-[390px] rounded-full bg-[#d2b3ef]/70 blur-3xl" />
      <div className="relative mx-auto max-w-[900px] text-center">
        <Crown className="mx-auto h-9 w-9 text-[#9b6dc7]" />
        <h2 className="mt-8 font-display text-5xl font-bold leading-[.88] tracking-[-.08em] text-[#3d2858] sm:text-8xl">Bring the almost-idea.<br /><span className="text-[#4e8b53]">We’ll meet you there.</span></h2>
        <p className="mx-auto mt-7 max-w-[500px] text-base leading-7 text-[#6c5a76]">No perfect prompt required. No right way in. Just a place to begin.</p>
        <button data-testid="button-final-begin" onClick={() => scrollToSection('studio')} className="portal-button mt-9 rounded-full bg-[#246745] px-7 py-4 text-sm font-semibold text-[#f5f7df]">Open a new world <Plus className="ml-1.5 inline h-4 w-4" /></button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#173f2b] px-5 py-10 text-[#dcebc6] sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1380px] flex-col justify-between gap-8 sm:flex-row sm:items-end">
        <div><button data-testid="button-footer-home" onClick={() => scrollToSection('home')} className="flex items-center gap-3"><LogoMark /><span className="font-display text-2xl font-extrabold tracking-[-.06em]">EvoAI</span></button><p className="mt-4 max-w-[300px] text-sm leading-6 text-[#9fbea0]">A welcoming portal for worlds that have not found their shape yet.</p></div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#9fbea0]"><button data-testid="link-footer-how" onClick={() => scrollToSection('how-it-works')} className="hover:text-[#dcebc6]">How it works</button><button data-testid="link-footer-studio" onClick={() => scrollToSection('studio')} className="hover:text-[#dcebc6]">Studio</button><button data-testid="link-footer-immerse" onClick={() => scrollToSection('immerse')} className="hover:text-[#dcebc6]">Immerse</button></div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1380px] justify-between border-t border-[#a5d58a]/15 pt-5 font-mono-ui text-[9px] uppercase tracking-[.16em] text-[#719379]"><span>© 2025 EvoAI</span><span>Made for curious minds</span></div>
    </footer>
  );
}

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="grain min-h-[100dvh] overflow-x-hidden">
      <Header onMenu={() => setMenuOpen(true)} />
      {menuOpen && <MobileMenu close={() => setMenuOpen(false)} />}
      <main>
        <Hero />
        <Pathways />
        <StudioPreview />
        <Immerse />
        <FinalCTA />
      </main>
      <Footer />
    </div>
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