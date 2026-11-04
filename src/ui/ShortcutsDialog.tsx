import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

const ROWS: Array<{ group: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    group: 'Move around',
    items: [
      { keys: ['0'], label: 'Open the studio overview' },
      { keys: ['1', '…', '8'], label: 'Jump straight to a lab' },
      { keys: ['?'], label: 'Show this shortcut sheet' },
      { keys: ['Esc'], label: 'Close a panel or dialog' },
    ],
  },
  {
    group: 'Teach',
    items: [
      { keys: ['H'], label: 'Hide / show every printed answer' },
      { keys: ['D'], label: 'Light ↔ dark projector theme' },
      { keys: ['F'], label: 'Full-screen presentation' },
      { keys: ['B'], label: 'Open the beam lab' },
    ],
  },
  {
    group: 'Share',
    items: [
      { keys: ['S'], label: 'Copy a link that restores this problem' },
      { keys: ['Ctrl', 'P'], label: 'Print the current lab' },
    ],
  },
];

export const ShortcutsDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] no-print" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,620px)] max-h-[86vh] overflow-y-auto rounded-2xl pop"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 24px 80px rgba(2,6,23,.32)' }}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Keyboard className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[13.5px] font-extrabold">Keyboard shortcuts</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>Built for a lecture desk, one hand on the keyboard, one on the mouse.</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 grid place-items-center rounded-lg" style={{ border: '1px solid var(--line)' }} aria-label="Close shortcuts">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ROWS.map((g) => (
            <section key={g.group}>
              <h3 className="text-[9.5px] font-extrabold uppercase tracking-widest mb-1.5" style={{ color: 'var(--ink-3)' }}>{g.group}</h3>
              <div className="space-y-1">
                {g.items.map((it) => (
                  <div key={it.label} className="rounded-lg px-2 py-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <div className="flex flex-wrap gap-1 mb-0.5">
                      {it.keys.map((k) => (
                        <kbd
                          key={k}
                          className="num rounded px-1.5 py-0.5 text-[9.5px] font-extrabold"
                          style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)', borderBottomWidth: 2, color: 'var(--ink-2)' }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <div className="text-[10px] leading-snug" style={{ color: 'var(--ink-2)' }}>{it.label}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="px-4 pb-4 text-[10px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          Shortcuts stay quiet while you are typing in a field, so they never steal a number from the model. Print uses the browser sheet, the
          side panels and header are already marked <span className="num">no-print</span>.
        </footer>
      </div>
    </div>
  );
};
