import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testTagSystem() {
  console.log('🧪 測試標籤系統...')
  
  try {
    // 1. 獲取所有標籤
    console.log('\n1. 獲取所有標籤:')
    const allTags = await prisma.tag.findMany()
    console.log(`找到 ${allTags.length} 個標籤:`)
    allTags.forEach(tag => {
      console.log(`  ${tag.emoji} ${tag.displayName} (${tag.name})`)
    })
    
    // 2. 獲取第一張照片 (如果存在)
    console.log('\n2. 查找照片:')
    const firstPhoto = await prisma.photo.findFirst({
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    })
    
    if (!firstPhoto) {
      console.log('  沒有找到照片，請先上傳一張照片')
      return
    }
    
    console.log(`  找到照片: ${firstPhoto.id} (用戶: ${firstPhoto.user.name || firstPhoto.user.email})`)
    
    // 3. 為照片添加標籤 (選擇前3個標籤)
    console.log('\n3. 為照片添加標籤:')
    const tagsToAdd = allTags.slice(0, 3)
    
    // 先清除現有標籤
    await prisma.photoTag.deleteMany({
      where: { photoId: firstPhoto.id }
    })
    
    // 添加新標籤
    const photoTags = tagsToAdd.map(tag => ({
      photoId: firstPhoto.id,
      tagId: tag.id
    }))
    
    await prisma.photoTag.createMany({
      data: photoTags
    })
    
    console.log(`  已添加標籤: ${tagsToAdd.map(t => t.displayName).join(', ')}`)
    
    // 4. 驗證標籤已添加
    console.log('\n4. 驗證照片標籤:')
    const photoWithTags = await prisma.photo.findUnique({
      where: { id: firstPhoto.id },
      include: {
        photoTags: {
          include: {
            tag: true
          }
        }
      }
    })
    
    if (photoWithTags) {
      console.log(`  照片 ${photoWithTags.id} 的標籤:`)
      photoWithTags.photoTags.forEach(pt => {
        console.log(`    ${pt.tag.emoji} ${pt.tag.displayName}`)
      })
    }
    
    // 5. 測試標籤搜索
    console.log('\n5. 測試標籤搜索:')
    const searchResults = await prisma.photo.findMany({
      where: {
        photoTags: {
          some: {
            tagId: {
              in: tagsToAdd.map(t => t.id)
            }
          }
        }
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        photoTags: {
          include: {
            tag: true
          }
        }
      }
    })
    
    console.log(`  找到 ${searchResults.length} 張帶有指定標籤的照片`)
    
    // 6. 獲取熱門標籤
    console.log('\n6. 熱門標籤統計:')
    const popularTags = await prisma.tag.findMany({
      include: {
        _count: {
          select: {
            photoTags: true
          }
        }
      },
      orderBy: {
        photoTags: {
          _count: 'desc'
        }
      }
    })
    
    popularTags.forEach(tag => {
      if (tag._count.photoTags > 0) {
        console.log(`  ${tag.emoji} ${tag.displayName}: ${tag._count.photoTags} 次使用`)
      }
    })
    
    console.log('\n✅ 標籤系統測試完成！')
    
  } catch (error) {
    console.error('❌ 測試失敗:', error)
  }
}

testTagSystem()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })