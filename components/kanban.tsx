"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export type KanbanItem = {
  id: string;
  column: string;
  title: string;
  meta?: string;
  href?: string;
};

export function Kanban({
  columns,
  items,
  onMove,
}: {
  columns: { id: string; title: string }[];
  items: KanbanItem[];
  onMove: (id: string, column: string) => Promise<void>;
}) {
  const [rows, setRows] = useState(items);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setRows(items);
  }, [items]);

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    const activeId = String(event.active.id);
    if (!overId) return;
    const over = String(overId);
    const column = columns.some((entry) => entry.id === over)
      ? over
      : rows.find((row) => row.id === over)?.column;
    const current = rows.find((row) => row.id === activeId);
    if (!column || !current || current.column === column) return;
    setRows((prev) => prev.map((row) => (row.id === activeId ? { ...row, column } : row)));
    startTransition(async () => {
      await onMove(activeId, column);
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4" aria-busy={pending}>
        {columns.map((column) => (
          <Column
            key={column.id}
            id={column.id}
            title={column.title}
            items={rows.filter((row) => row.column === column.id)}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({ id, title, items }: { id: string; title: string; items: KanbanItem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-2 ring-1 ring-foreground/10 ${isOver ? "bg-primary/10" : ""}`}
    >
      <header className="flex items-center justify-between px-1 py-1.5">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {items.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function Card({ item }: { item: KanbanItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 ${isDragging ? "opacity-60" : ""}`}
      {...listeners}
      {...attributes}
    >
      {item.href ? (
        <Link href={item.href} className="font-medium hover:underline">
          {item.title}
        </Link>
      ) : (
        <p className="font-medium">{item.title}</p>
      )}
      {item.meta ? <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p> : null}
    </article>
  );
}
