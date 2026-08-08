import { useEffect, useState, type ReactNode } from 'react';
import { profile, projects } from '../content';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * In-canvas AC clock pill (bottom-left). Renders `#clock` so UiPanels can
 * pick it up via getElementById. Re-renders every 20s → DOM text mutates →
 * the polyfill re-rasters the texture automatically.
 */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const date = `${MONTHS[now.getMonth()]} ${now.getDate()} · ${WEEKDAYS[now.getDay()]}`;
  return (
    <div id="clock" className="clock">
      <span className="clock-leaf">🍃</span>
      <span className="clock-text">
        <span className="clock-time">{hh}:{mm}</span>
        <span className="clock-date">{date}</span>
      </span>
    </div>
  );
}

/** Types text out character-by-character, like an AC villager talking. */
function useTypewriter(text: string, charsPerSecond = 30): string {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, 1000 / charsPerSecond);
    return () => window.clearInterval(id);
  }, [text, charsPerSecond]);
  return text.slice(0, count);
}

function DialogShell({ name, children }: { name: string; children: ReactNode }) {
  // NOTE: React synthetic events don't reach in-canvas DOM (the polyfill
  // reparents it outside the React root), so navigation is delegated to a
  // native capture-phase listener in App via [data-nav].
  return (
    <div className="dialog">
      <div className="name-tag">{name}</div>
      <button className="close-btn" aria-label="Close dialog" data-nav="/">
        ✕
      </button>
      {children}
    </div>
  );
}

export function AboutDialog() {
  const typed = useTypewriter(profile.greeting);
  const typing = typed.length < profile.greeting.length;
  return (
    <DialogShell name={profile.name}>
      <p className={typing ? 'typewriter typing' : 'typewriter'}>{typed}</p>
      <p className="dialog-aside">
        {profile.role} · 🍃 This whole island — including this dialog — is rendered in WebGL.
      </p>
      <div className="row">
        <a className="ac-link" href={profile.blog.url} target="_blank" rel="noreferrer">
          📝 Blog
        </a>
        <a className="ac-link secondary" href={profile.github.url} target="_blank" rel="noreferrer">
          🐙 GitHub
        </a>
      </div>
    </DialogShell>
  );
}

export function ProjectsDialog() {
  return (
    <DialogShell name="Museum Exhibits">
      <p className="dialog-subtitle">🍃 Curated exhibits from github.com/huangcheng</p>
      <div className="project-list">
        {projects.map((p) => (
          <a key={p.title} className="project-card" href={p.repo} target="_blank" rel="noreferrer">
            <div className="pc-head">
              <span>{p.emoji}</span>
              <span>{p.title}</span>
              <span className="pc-stars">★ {p.stars}</span>
            </div>
            <div className="pc-tagline">{p.tagline}</div>
            <div className="pc-stack">
              {p.stack.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
      <div className="scroll-note">Donations of bells happily accepted 🔔</div>
    </DialogShell>
  );
}

export function ContactDialog() {
  return (
    <DialogShell name="Notice Board">
      <p>The island mailbox is always open! 📬 Project ideas, a role to fill, or just a friendly wave — I'd love to hear from you.</p>
      <div className="row">
        <a className="ac-link mail" href={profile.email.url}>
          ✉ {profile.email.label}
        </a>
        <a className="ac-link secondary" href={profile.github.url} target="_blank" rel="noreferrer">
          🐙 GitHub
        </a>
        <a className="ac-link" href={profile.blog.url} target="_blank" rel="noreferrer">
          📝 {profile.blog.label}
        </a>
      </div>
      <div className="scroll-note">No stamps needed on this island 💌</div>
    </DialogShell>
  );
}
