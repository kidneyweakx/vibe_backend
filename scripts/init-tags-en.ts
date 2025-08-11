import getPrisma from '../src/dbConfig'
const prisma = getPrisma()

const tags = [
  { name: 'sporty', displayName: 'Sporty' },
  { name: 'streetwear', displayName: 'Streetwear' },
  { name: 'vintage', displayName: 'Vintage' },
  { name: 'minimalist', displayName: 'Minimalist' },
  { name: 'formal', displayName: 'Formal' },
  { name: 'coquette', displayName: 'Coquette' },
  { name: 'gorpcore', displayName: 'Gorpcore' },
  { name: 'y2k', displayName: 'Y2K' },
  { name: 'preppy', displayName: 'Preppy' },
  { name: 'darkwear', displayName: 'Darkwear' },
]

async function initTagsEn() {
  console.log('Seeding English tags...')

  for (const t of tags) {
    try {
      await prisma.tag.upsert({
        where: { name: t.name },
        update: { displayName: t.displayName },
        create: { name: t.name, displayName: t.displayName },
      })
      console.log(`✅ ${t.displayName} (${t.name})`)
    } catch (err) {
      console.error(`❌ Failed: ${t.displayName}`, err)
    }
  }

  console.log('Done.')
}

initTagsEn()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


