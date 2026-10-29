import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/server-auth';
import { PreviewBoard } from './preview-board';

export const dynamic = 'force-dynamic';

export default async function PreviewPage() {
  if (!(await isAuthenticated())) redirect('/admin/login');
  return <PreviewBoard />;
}
