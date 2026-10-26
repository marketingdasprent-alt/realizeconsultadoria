// Tipos das Tarefas (briefing §15).

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskRecurrence = 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  createdBy: string | null;
  assigneeId: string | null;
  participantIds: string[];
  recurrence: TaskRecurrence | null;
  sourceType: 'message' | 'email' | 'event' | null;
  sourceRef: string | null;
  position: number;
  createdAt: string;
  completedAt: string | null;
  /** Subtarefas e itens da lista (para os contadores dos cartões). */
  subtaskCount: number;
  subtaskDone: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface TaskComment {
  id: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  path: string;
  name: string;
  size: number;
  mime: string | null;
  uploadedBy: string | null;
}

export interface TaskInput {
  title: string;
  description: string;
  assigneeId: string | null;
  participantIds: string[];
  dueAt: string | null;
  priority: TaskPriority;
  recurrence: TaskRecurrence | null;
  parentId?: string | null;
  sourceType?: Task['sourceType'];
  sourceRef?: string | null;
  /** Só ao criar: ficheiros a anexar logo à tarefa nova. */
  files?: File[];
}

export type TaskScope = 'mine' | 'created' | 'all';
export type TaskView = 'list' | 'board' | 'calendar';
