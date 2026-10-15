import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, KanbanSquare, List, Loader2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { TaskBoard } from '../components/TaskBoard';
import { TaskCalendar } from '../components/TaskCalendar';
import { TaskDetailSheet } from '../components/TaskDetailSheet';
import { TaskFormDialog } from '../components/TaskFormDialog';
import { TaskList } from '../components/TaskList';
import { useTasks } from '../hooks/useTasks';
import { filterTasks, TASK_SCOPES } from '../lib/taskRules';
import type { Task, TaskScope, TaskView } from '../types';

const VIEWS: { key: TaskView; label: string; icon: React.ElementType }[] = [
  { key: 'list', label: 'Lista', icon: List },
  { key: 'board', label: 'Quadro', icon: KanbanSquare },
  { key: 'calendar', label: 'Calendário', icon: CalendarDays },
];

/** Tarefas (briefing §15): lista, quadro Kanban e calendário; a tarefa aberta fica no endereço. */
const TasksPage: React.FC = () => {
  const { user } = useWorkspace();
  const tasks = useTasks();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<TaskView>('list');
  const [scope, setScope] = useState<TaskScope>('mine');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Task | null | 'new'>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const openId = params.get('tarefa');
  const open = tasks.tasks.find(t => t.id === openId) ?? null;
  const visible = useMemo(
    () => filterTasks(tasks.tasks, scope, user.userId, query),
    [tasks.tasks, scope, user.userId, query]
  );

  useEffect(() => {
    if (params.get('nova')) {
      setEditing('new');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const openTask = (task: Task) => setParams({ tarefa: task.id });
  const setStatus = (task: Task, status: Task['status']) => tasks.update(task.id, { status });

  return (
    <WorkspacePage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold">Tarefas</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_hsl(var(--rz-primary))]"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-white p-1 ring-1 ring-rz-line">
          {VIEWS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold',
                view === v.key ? 'bg-rz-ink text-white' : 'text-rz-muted'
              )}
            >
              <v.icon className="h-4 w-4" /> <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto">
          {TASK_SCOPES.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold',
                scope === s.key
                  ? 'bg-rz-primary-soft text-rz-primary'
                  : 'bg-white text-rz-muted ring-1 ring-rz-line'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex h-10 w-full items-center gap-2 rounded-full bg-white px-4 text-rz-muted ring-1 ring-rz-line sm:w-60">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Procurar tarefa"
            className="w-full bg-transparent text-sm text-rz-ink outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        {tasks.isLoading ? (
          <Loader2 className="mx-auto mt-10 h-7 w-7 animate-spin text-rz-primary" />
        ) : view === 'list' ? (
          <TaskList
            tasks={visible}
            onOpen={openTask}
            onToggleDone={t => setStatus(t, t.status === 'done' ? 'todo' : 'done')}
          />
        ) : view === 'board' ? (
          <TaskBoard
            tasks={visible}
            onOpen={openTask}
            onMove={(t, status, position) => tasks.update(t.id, { status, position })}
          />
        ) : (
          <TaskCalendar tasks={visible} onOpen={openTask} />
        )}
      </div>

      <TaskDetailSheet
        task={open}
        subtasks={tasks.tasks.filter(t => t.parentId === open?.id)}
        onClose={() => setParams({})}
        onEdit={setEditing}
        onDelete={setToDelete}
        onStatus={setStatus}
        onParticipants={tasks.setParticipants}
        onAddSubtask={(parent, title) =>
          tasks.create({
            title,
            description: '',
            assigneeId: user.userId,
            participantIds: [],
            dueAt: null,
            priority: parent.priority,
            recurrence: null,
            parentId: parent.id,
          })
        }
        onOpen={openTask}
      />
      <TaskFormDialog
        open={!!editing}
        onOpenChange={value => !value && setEditing(null)}
        task={editing === 'new' ? null : editing}
        onSave={async input => {
          if (editing && editing !== 'new') {
            await tasks.update(editing.id, {
              title: input.title,
              description: input.description || null,
              assigneeId: input.assigneeId,
              dueAt: input.dueAt,
              priority: input.priority,
              recurrence: input.recurrence,
            });
            await tasks.setParticipants(editing, input.participantIds);
          } else {
            const id = await tasks.create(input);
            if (id) setParams({ tarefa: id });
          }
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar tarefa?"
        description="A tarefa, as subtarefas, os comentários e os anexos são eliminados para todos."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (toDelete) tasks.remove(toDelete.id);
          setParams({});
        }}
        onClose={() => setToDelete(null)}
      />
    </WorkspacePage>
  );
};

export default TasksPage;
