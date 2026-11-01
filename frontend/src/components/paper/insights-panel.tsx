import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Insights } from "@/types/api";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2 p-4 shadow-sm">
      <h3 className="text-[16px] font-semibold">{title}</h3>
      {children}
    </Card>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[14px] text-text-muted">None listed.</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[14px] text-text-muted">None listed.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item}>
          <Badge variant="secondary" className="rounded-full text-[13px] font-normal text-text">
            {item}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function InsightsPanel({ insights }: { insights: Insights }) {
  return (
    <div className="space-y-4">
      <Card className="gap-1.5 border-primary/40 bg-primary-soft p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-wide text-primary uppercase">TL;DR</h3>
        <p className="max-w-[75ch] text-[16px] text-text">{insights.tldr}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Section title="Problem">
          <p className="text-[15px]">{insights.problem}</p>
        </Section>
        <Section title="Method">
          <p className="text-[15px]">{insights.method}</p>
        </Section>
        <Section title="Key results">
          <Bullets items={insights.key_results} />
        </Section>
        <Section title="Datasets">
          <Chips items={insights.datasets} />
        </Section>
        <Section title="Metrics">
          <Chips items={insights.metrics} />
        </Section>
        <Section title="Limitations">
          <Bullets items={insights.limitations} />
        </Section>
      </div>

      <Section title="Contributions">
        <Bullets items={insights.contributions} />
      </Section>

      <p className="text-[14px] text-text-muted">Field: {insights.field}</p>
    </div>
  );
}
