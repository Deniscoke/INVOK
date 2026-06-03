import type { Role } from '../services/authService';

const LABEL: Record<Role, string> = {
  admin: 'Admin školy',
  teacher: 'Učiteľ',
  student: 'Žiak',
};

const CLASS: Record<Role, string> = {
  admin: 'chip chip--warm',
  teacher: 'chip chip--accent',
  student: 'chip',
};

export function RoleBadge(role: Role): string {
  return `<span class="${CLASS[role]}">${LABEL[role]}</span>`;
}
