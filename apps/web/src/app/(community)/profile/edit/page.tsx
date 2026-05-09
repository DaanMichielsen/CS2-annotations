import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import EditProfileForm from './EditProfileForm'

export default async function EditProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  return <EditProfileForm />
}
