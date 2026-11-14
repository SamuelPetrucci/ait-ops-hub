"use client";

import { moveContent, moveDeal, moveTask } from "@/app/actions/mutations";
import { Kanban, type KanbanItem } from "@/components/kanban";
import { CONTENT_COLUMNS, DEAL_COLUMNS, TASK_COLUMNS } from "@/lib/constants";

export function DealBoard({ items }: { items: KanbanItem[] }) {
  return <Kanban columns={DEAL_COLUMNS.map(([id, title]) => ({ id, title }))} items={items} onMove={moveDeal} />;
}

export function TaskBoard({ items }: { items: KanbanItem[] }) {
  return <Kanban columns={TASK_COLUMNS.map(([id, title]) => ({ id, title }))} items={items} onMove={moveTask} />;
}

export function ContentBoard({ items }: { items: KanbanItem[] }) {
  return (
    <Kanban columns={CONTENT_COLUMNS.map(([id, title]) => ({ id, title }))} items={items} onMove={moveContent} />
  );
}
