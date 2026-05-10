import { auth } from '@/lib/auth'
import { requireRole } from '@/lib/roles'
import UserManagementClient from './UserManagementClient'

export default async function AdminUsersPage() {
  const session = await auth()
  requireRole(session, 'admin')
  return <UserManagementClient />
}
