import { Check } from "lucide-react";

export function LaisrLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "laisr-logo compact" : "laisr-logo"} aria-label="LAISR">
      <span className="laisr-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" role="img">
          <path className="logo-page" d="M10 6h14l7 7v21H10z" />
          <path className="logo-fold" d="M24 6v8h7" />
          <circle className="logo-lens" cx="20" cy="22" r="7" />
          <path className="logo-beam" d="M25 27l6 6" />
        </svg>
        <Check size={13} strokeWidth={3} />
      </span>
      <span className="laisr-logo-word">LAISR</span>
    </div>
  );
}
