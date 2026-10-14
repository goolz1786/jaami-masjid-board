import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/server-auth';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/admin');
  return <LoginForm />;
}
