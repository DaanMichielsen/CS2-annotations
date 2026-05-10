import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import EditProfileForm from './EditProfileForm'

export default async function EditProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const isAdmin = session.user.roles?.includes('admin') ?? false
  return <EditProfileForm isAdmin={isAdmin} />
}
