// Tarefas de exemplo (só na pré-visualização /dev/realize-2/tarefas).
import type { ChecklistItem, Task, TaskComment } from '../types';

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const base: Omit<Task, 'id' | 'title' | 'status'> = {
  parentId: null,
  description: null,
  priority: 'medium',
  dueAt: null,
  createdBy: 'me',
  assigneeId: 'me',
  participantIds: [],
  recurrence: null,
  sourceType: null,
  sourceRef: null,
  position: 0,
  createdAt: days(-3),
  completedAt: null,
  subtaskCount: 0,
  subtaskDone: 0,
};

export const DEMO_TASKS: Task[] = [
  {
    ...base,
    id: 'dt1',
    title: 'Preparar o relatório mensal de operações',
    description: 'Juntar os números de setembro e enviar à direção até sexta.',
    status: 'in_progress',
    priority: 'high',
    dueAt: days(1),
    participantIds: ['rui'],
    subtaskCount: 3,
    subtaskDone: 1,
  },
  {
    ...base,
    id: 'dt2',
    title: 'Rever contratos de novos motoristas',
    status: 'todo',
    priority: 'urgent',
    dueAt: days(-1),
    createdBy: 'marta',
  },
  {
    ...base,
    id: 'dt3',
    title: 'Atualizar escala de novembro',
    status: 'todo',
    dueAt: days(5),
    position: 1,
  },
  {
    ...base,
    id: 'dt4',
    title: 'Enviar mapa de férias aos RH',
    status: 'review',
    assigneeId: 'ana',
    dueAt: days(2),
    sourceType: 'message',
    recurrence: 'monthly',
  },
  {
    ...base,
    id: 'dt5',
    title: 'Organizar formação de segurança',
    status: 'done',
    completedAt: days(-1),
  },
];

export const DEMO_CHECKLIST: Record<string, ChecklistItem[]> = {
  dt1: [
    { id: 'c1', text: 'Exportar dados do sistema', done: true, position: 0 },
    { id: 'c2', text: 'Gráficos de horas por equipa', done: false, position: 1 },
    { id: 'c3', text: 'Rever com o Rui', done: false, position: 2 },
  ],
};

export const DEMO_TASK_COMMENTS: Record<string, TaskComment[]> = {
  dt1: [
    {
      id: 'k1',
      authorId: 'rui',
      body: 'Os dados de Lisboa já estão na pasta partilhada.',
      createdAt: days(-1),
    },
  ],
};
