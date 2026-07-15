'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { type TaskStatus, type TaskSummary } from '@/lib/api';

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'ToDo', label: 'To Do', color: 'bg-gray-100' },
  { status: 'InProgress', label: 'In Progress', color: 'bg-blue-50' },
  { status: 'InReview', label: 'In Review', color: 'bg-amber-50' },
  { status: 'Done', label: 'Done', color: 'bg-green-50' },
];

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-200 text-gray-700',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

function TaskCard({ task, isDragging = false }: { task: TaskSummary; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded border p-2 mb-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="text-sm font-medium text-gray-800 mb-1 line-clamp-2">{task.title}</div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
        {task.assignee && (
          <span className="text-xs text-gray-500">→ {task.assignee.fullName}</span>
        )}
        {task.dueDate && (
          <span className="text-xs text-gray-400 ml-auto">
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  tasks: TaskSummary[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export default function KanbanView({ tasks, onStatusChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find(t => t.id === active.id);
    if (!draggedTask) return;

    // over.id could be a column status or another task id
    let targetStatus: TaskStatus | null = null;
    const col = COLUMNS.find(c => c.status === over.id);
    if (col) {
      targetStatus = col.status;
    } else {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask && overTask.status !== draggedTask.status) {
        targetStatus = overTask.status;
      }
    }

    if (targetStatus && targetStatus !== draggedTask.status) {
      await onStatusChange(draggedTask.id, targetStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.status);
          return (
            <div key={col.status} className={`flex-shrink-0 w-64 rounded-lg p-3 ${col.color}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm text-gray-700">{col.label}</span>
                <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500">
                  {colTasks.length}
                </span>
              </div>
              <SortableContext
                id={col.status}
                items={colTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {/* droppable area — use col.status as drop target id via a wrapper */}
                <div
                  data-droppable-id={col.status}
                  className="min-h-16"
                  onMouseUp={() => {
                    if (activeId) {
                      const draggedTask = tasks.find(t => t.id === activeId);
                      if (draggedTask && draggedTask.status !== col.status) {
                        onStatusChange(activeId, col.status);
                      }
                    }
                  }}
                >
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} isDragging={task.id === activeId} />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="bg-white rounded border p-2 shadow-xl opacity-95 w-64">
            <div className="text-sm font-medium text-gray-800">{activeTask.title}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
