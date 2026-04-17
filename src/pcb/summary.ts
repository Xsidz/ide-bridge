import type { Pcb } from "./schema.js";

export function extractSummary(pcb: Pcb): string {
  const parts: string[] = [];
  if (pcb.plan.summary) parts.push(`Goal: ${pcb.plan.summary.slice(0, 120)}.`);
  if (pcb.plan.current_step) parts.push(`Now: ${pcb.plan.current_step.slice(0, 80)}.`);
  const recentDecisions = pcb.decisions.slice(-3).map(d => d.text).join("; ");
  if (recentDecisions) parts.push(`Decisions: ${recentDecisions.slice(0, 160)}.`);
  const openTodos = pcb.todos.filter(t => t.status !== "done").slice(0, 3).map(t => t.text).join("; ");
  if (openTodos) parts.push(`Open: ${openTodos.slice(0, 120)}.`);
  return parts.join(" ").slice(0, 500);
}
