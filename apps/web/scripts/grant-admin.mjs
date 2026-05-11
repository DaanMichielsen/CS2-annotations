import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: node scripts/grant-admin.mjs <username-or-steamId>')
    process.exit(1)
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { username: arg },
        { steamId: arg },
      ],
    },
    include: { roles: true },
  })

  if (!user) {
    console.error(`User not found: "${arg}". Try your Steam ID (e.g. 76561198xxxxxxxxx) or username.`)
    process.exit(1)
  }

  const alreadyAdmin = user.roles.some((r) => r.role === 'admin')
  if (alreadyAdmin) {
    console.log(`${user.username ?? user.name} already has admin role.`)
    return
  }

  await db.userRole.create({
    data: { userId: user.id, role: 'admin' },
  })

  console.log(`✓ Granted admin role to ${user.username ?? user.name} (id: ${user.id})`)
}

main().catch(console.error).finally(() => db.$disconnect())
