'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Image from 'next/image'
import { searchUsers, grantRole, revokeRole } from './actions'

type User = Awaited<ReturnType<typeof searchUsers>>[number]

const AVAILABLE_ROLES = ['admin']

export default function UserManagementClient() {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [isPending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await searchUsers(q)
        setUsers(result)
      })
    }, 300)
    return () => clearTimeout(timer.current)
  }, [q])

  // Load initial users
  useEffect(() => {
    startTransition(async () => {
      const result = await searchUsers('')
      setUsers(result)
    })
  }, [])

  function handleGrant(userId: string, role: string) {
    startTransition(async () => {
      await grantRole(userId, role)
      const result = await searchUsers(q)
      setUsers(result)
    })
  }

  function handleRevoke(userId: string, role: string) {
    startTransition(async () => {
      await revokeRole(userId, role)
      const result = await searchUsers(q)
      setUsers(result)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-white">Users</h1>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by username or Steam ID…"
        className="w-full max-w-sm px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-sm focus:outline-none focus:border-zinc-500 mb-6"
      />

      {isPending && <p className="text-zinc-500 text-sm">Loading…</p>}

      {!isPending && users.length === 0 && (
        <p className="text-zinc-600 text-sm">No users found.</p>
      )}

      <div className="space-y-2">
        {users.map((user) => {
          const heldRoles = user.roles.map((r) => r.role)
          const grantableRoles = AVAILABLE_ROLES.filter((r) => !heldRoles.includes(r))

          return (
            <div
              key={user.id}
              className="flex items-center gap-4 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg"
            >
              {/* Avatar */}
              <div className="shrink-0">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.username ?? user.name ?? ''}
                    width={36}
                    height={36}
                    className="rounded-full ring-1 ring-zinc-700"
                    unoptimized
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">
                  {user.username ?? user.name ?? 'Anonymous'}
                </p>
                <p className="text-xs text-zinc-600 truncate">{user.steamId}</p>
              </div>

              {/* Current roles */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {heldRoles.map((role) => (
                  <span
                    key={role}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 bg-violet-900/50 border border-violet-700/50 text-violet-300 rounded"
                  >
                    {role}
                    <button
                      type="button"
                      onClick={() => handleRevoke(user.id, role)}
                      className="text-violet-500 hover:text-red-400 transition-colors leading-none"
                      title={`Revoke ${role}`}
                    >
                      ×
                    </button>
                  </span>
                ))}

                {/* Grant dropdown */}
                {grantableRoles.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleGrant(user.id, e.target.value)
                      e.target.value = ''
                    }}
                    className="text-xs px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded cursor-pointer focus:outline-none"
                  >
                    <option value="">Grant role…</option>
                    {grantableRoles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
