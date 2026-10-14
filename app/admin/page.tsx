import { redirect } from 'next/navigation';
import { currentUser, isAuthenticated } from '@/lib/server-auth';
import { AdminApp } from './admin-app';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const actor = await currentUser();
  return <AdminApp role={actor?.role ?? 'editor'} />;
}
