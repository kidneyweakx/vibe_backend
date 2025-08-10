import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultTags = [
  {
    name: 'sporty',
    displayName: '運動風',
    emoji: '🏃‍♀️',
    color: '#FF6B35',
    category: 'style'
  },
  {
    name: 'streetwear',
    displayName: '街頭潮流',
    emoji: '🛹',
    color: '#2E86AB',
    category: 'style'
  },
  {
    name: 'vintage',
    displayName: '復古風',
    emoji: '📻',
    color: '#A23B72',
    category: 'style'
  },
  {
    name: 'minimalist',
    displayName: '簡約風',
    emoji: '⚪',
    color: '#F18F01',
    category: 'style'
  },
  {
    name: 'formal',
    displayName: '正式風',
    emoji: '👔',
    color: '#C73E1D',
    category: 'style'
  },
  {
    name: 'coquette',
    displayName: '甜美風',
    emoji: '🎀',
    color: '#FFB3C6',
    category: 'style'
  },
  {
    name: 'gorpcore',
    displayName: '戶外機能風',
    emoji: '🏔️',
    color: '#4A5D23',
    category: 'style'
  },
  {
    name: 'y2k',
    displayName: 'Y2K千禧風',
    emoji: '💿',
    color: '#9B59B6',
    category: 'style'
  },
  {
    name: 'preppy',
    displayName: '學院風',
    emoji: '📚',
    color: '#3498DB',
    category: 'style'
  },
  {
    name: 'darkwear',
    displayName: '暗黑風',
    emoji: '🖤',
    color: '#2C3E50',
    category: 'style'
  }
]

async function initTags() {
  console.log('正在初始化標籤...')
  
  for (const tagData of defaultTags) {
    try {
      const tag = await prisma.tag.upsert({
        where: { name: tagData.name },
        update: tagData,
        create: tagData
      })
      console.log(`✅ 標籤已創建/更新: ${tag.displayName} (${tag.name})`)
    } catch (error) {
      console.error(`❌ 創建標籤失敗: ${tagData.displayName}`, error)
    }
  }
  
  console.log('標籤初始化完成！')
}

initTags()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })