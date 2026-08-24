import type { Tab } from "@/lib/types";

interface TabNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "ledger", label: "Ledger" },
    { id: "report", label: "Report" },
    { id: "methodology", label: "Methodology" },
  ];

  return (
    <nav
      className="flex items-center gap-8 border-b border-ledger-border"
      aria-label="Token Ledger sections"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative pb-4 text-sm uppercase tracking-[0.22em] transition-colors ${
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
