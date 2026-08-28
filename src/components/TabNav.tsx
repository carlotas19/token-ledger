import type { Tab } from "@/lib/types";

interface TabNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "results", label: "Results" },
    { id: "report", label: "Report" },
    { id: "reproduce", label: "Reproduce the benchmark" },
  ];

  return (
    <nav
      className="flex items-center gap-5 overflow-x-auto border-b border-ledger-border sm:gap-8"
      aria-label="Tokenomics benchmark sections"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative shrink-0 pb-4 text-xs uppercase tracking-[0.18em] transition-colors sm:text-sm sm:tracking-[0.22em] ${
            activeTab === tab.id
              ? "text-ledger-cream"
              : "text-ledger-muted hover:text-ledger-cream/75"
          }`}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 h-px w-full bg-neon-green" />
          )}
        </button>
      ))}
    </nav>
  );
}
