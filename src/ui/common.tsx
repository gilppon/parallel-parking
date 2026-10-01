import { useEffect, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { audio } from '../game/AudioFx';
import { store, type SaveData } from '../game/save';
import { cn } from '../utils/cn';

export function useSave(): SaveData {
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useEscape(handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handler, enabled]);
}

type Tone = 'lime' | 'cyan' | 'pink' | 'amber' | 'ghost' | 'red';

const TONES: Record<Tone, string> = {
  lime: 'bg-lime-400 text-slate-950 shadow-[0_6px_0_#4d7c0f] hover:bg-lime-300 active:shadow-[0_2px_0_#4d7c0f]',
  cyan: 'bg-cyan-400 text-slate-950 shadow-[0_6px_0_#0e7490] hover:bg-cyan-300 active:shadow-[0_2px_0_#0e7490]',
  pink: 'bg-pink-500 text-white shadow-[0_6px_0_#9d174d] hover:bg-pink-400 active:shadow-[0_2px_0_#9d174d]',
  amber: 'bg-amber-400 text-slate-950 shadow-[0_6px_0_#b45309] hover:bg-amber-300 active:shadow-[0_2px_0_#b45309]',
  red: 'bg-red-500 text-white shadow-[0_6px_0_#991b1b] hover:bg-red-400 active:shadow-[0_2px_0_#991b1b]',
  ghost: 'bg-white/10 text-white border border-white/20 hover:bg-white/20 shadow-none',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Btn({ tone = 'lime', size = 'md', className, children, onClick, disabled, ...rest }: BtnProps) {
  return (
    <button
      tabIndex={-1}
      type="button"
      {...rest}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        audio.unlock();
        audio.click();
        onClick?.(e);
        (e.currentTarget as HTMLButtonElement).blur();
      }}
      className={cn(
        'font-display rounded-xl transition-all active:translate-y-[4px] disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none whitespace-nowrap',
        size === 'sm' && 'px-4 py-2 text-[16px]',
        size === 'md' && 'px-6 py-3 text-[20px]',
        size === 'lg' && 'px-9 py-4 text-[28px]',
        TONES[tone],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Stars({ n, size = 22, className }: { n: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} style={{ fontSize: size }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]' : 'text-white/20'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function CoinBadge({ coins, className }: { coins: number; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-black/55 border border-amber-300/40 pl-2 pr-4 py-1 font-display text-[20px] text-amber-200',
        className
      )}
    >
      <span className="grid place-items-center w-7 h-7 rounded-full bg-amber-400 text-amber-900 text-[15px] shadow-inner">🪙</span>
      {coins.toLocaleString()}
    </div>
  );
}

export function Keycap({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <span
      className={cn(
        'inline-grid place-items-center h-8 min-w-8 px-2 rounded-md bg-white/90 text-slate-900 font-bold text-[14px] shadow-[0_3px_0_#94a3b8]',
        wide && 'px-4'
      )}
    >
      {children}
    </span>
  );
}
