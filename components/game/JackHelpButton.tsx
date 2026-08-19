"use client";

import { useState } from "react";
import { JackLegendRows } from "./JackLegend";

// Desktop gets the always-visible sidebar panel (JackLegend); on mobile
// that sidebar is hidden for space, so this is the only place a player on
// a phone can find the two-eyed/one-eyed jack explanation. Visual/markup
// affordance only — no game-logic changes.
export default function JackHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Jack card help"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-panel-border bg-panel text-sm font-bold text-panel-ink shadow-card transition active:scale-95 lg:hidden"
      >
        ?
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
          />
          <div
            role="dialog"
            aria-label="Jack card help"
            className="animate-fade-slide-up relative w-full max-w-md rounded-t-panel border-t border-panel-border bg-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-sm text-panel-ink-soft shadow-panel"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-panel-border" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold text-panel-ink">Jack cards</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-panel-ink-soft transition hover:bg-card-border/40"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <JackLegendRows />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
