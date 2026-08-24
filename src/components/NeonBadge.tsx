export function NeonBadge() {
  return (
    <a
      href="https://neon.com/docs/ai-gateway/overview"
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-ledger-border bg-ledger-charcoal/90 px-4 py-2.5 backdrop-blur-sm transition-all hover:border-neon-green/40 hover:bg-ledger-panel"
      aria-label="Built using Neon AI Gateway"
    >
      <NeonLogo className="h-4 w-4 text-neon-green transition-transform group-hover:scale-110" />
      <span className="text-sm tracking-wide text-ledger-muted transition-colors group-hover:text-ledger-cream">
        Built with{" "}
        <span className="text-ledger-cream group-hover:text-neon-green">
          Neon AI Gateway
        </span>
      </span>
    </a>
  );
}

function NeonLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7.5 3.75v7.14L12 18.82l-7.5-3.75V7.93L12 4.18z" />
      <path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm0 2a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
    </svg>
  );
}
