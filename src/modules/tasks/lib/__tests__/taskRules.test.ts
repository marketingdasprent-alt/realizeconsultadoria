import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import { filterTasks, groupByStatus, isOverdue, positionBetween, sortTasks } from '../taskRules';

const task = (overrides: Partial<Task>): Task => ({
  id: 't',
  parentId: null,
  title: 'Tarefa',
  description: null,
  status: 'todo',
  priority: 'medium',
  dueAt: null,
  createdBy: 'me',
  assigneeId: 'me',
  participantIds: [],
  recurrence: null,
  sourceType: null,
  sourceRef: null,
  position: 0,
  createdAt: '2026-10-01T10:00:00Z',
  completedAt: null,
  subtaskCount: 0,
  subtaskDone: 0,
  ...overrides,
});

describe('tarefas', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  it('atrasada só se tiver prazo passado e não estiver concluída', () => {
    expect(isOverdue(task({ dueAt: '2026-10-14T09:00:00Z' }), now)).toBe(true);
    expect(isOverdue(task({ dueAt: '2026-10-14T09:00:00Z', status: 'done' }), now)).toBe(false);
    expect(isOverdue(task({ dueAt: '2026-10-16T09:00:00Z' }), now)).toBe(false);
    expect(isOverdue(task({}), now)).toBe(false);
  });

  it('âmbitos: atribuídas, criadas, todas — sem subtarefas', () => {
    const list = [
      task({ id: 'a', assigneeId: 'me', createdBy: 'ana' }),
      task({ id: 'b', assigneeId: 'ana', createdBy: 'me' }),
      task({ id: 'c', assigneeId: 'me', createdBy: 'me', parentId: 'b' }),
    ];
    expect(filterTasks(list, 'mine', 'me').map(t => t.id)).toEqual(['a']);
    expect(filterTasks(list, 'created', 'me').map(t => t.id)).toEqual(['b']);
    expect(filterTasks(list, 'all', 'me').map(t => t.id)).toEqual(['a', 'b']);
    expect(filterTasks(list, 'all', 'me', 'nada').length).toBe(0);
  });

  it('as minhas inclui as tarefas em que participo', () => {
    const list = [
      task({ id: 'a', assigneeId: 'thiago', createdBy: 'thiago', participantIds: ['joao'] }),
      task({ id: 'b', assigneeId: 'thiago', createdBy: 'thiago' }),
    ];
    expect(filterTasks(list, 'mine', 'joao').map(t => t.id)).toEqual(['a']);
  });

  it('ordena: por concluir, prazo mais próximo, prioridade', () => {
    const sorted = sortTasks([
      task({ id: 'done', status: 'done', dueAt: '2026-10-10T00:00:00Z' }),
      task({ id: 'no-due-urgent', priority: 'urgent' }),
      task({ id: 'due-later', dueAt: '2026-10-20T00:00:00Z' }),
      task({ id: 'due-soon', dueAt: '2026-10-16T00:00:00Z' }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(['due-soon', 'due-later', 'no-due-urgent', 'done']);
  });

  it('quadro agrupa por estado e respeita a posição', () => {
    const groups = groupByStatus([
      task({ id: 'x', status: 'in_progress', position: 2 }),
      task({ id: 'y', status: 'in_progress', position: 1 }),
      task({ id: 'z', status: 'done' }),
    ]);
    expect(groups.in_progress.map(t => t.id)).toEqual(['y', 'x']);
    expect(groups.done).toHaveLength(1);
    expect(groups.todo).toHaveLength(0);
  });

  it('posição entre vizinhos', () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(undefined, 2)).toBe(1);
    expect(positionBetween(4, undefined)).toBe(5);
    expect(positionBetween()).toBe(0);
  });
});
