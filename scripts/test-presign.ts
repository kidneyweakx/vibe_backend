import { getPresignedGetUrl, getPublicObjectUrl } from '../src/services/r2/presign'
import getPrisma from '../src/dbConfig'
import { bindRuntimeEnv } from '../src/env'
import { config } from 'dotenv'

// Load environment variables
config()

// Bind environment to global for the app
bindRuntimeEnv(process.env)

async function testPresignedUrls() {
  try {
    console.log('🔍 Testing presigned URLs...')
    
    // Get a random user with photos
    const prisma = getPrisma()
    const userWithPhotos = await prisma.user.findFirst({
      where: {
        photos: {
          some: {}
        }
      },
      include: {
        photos: {
          take: 1,
          select: {
            id: true,
            key: true,
            uploadedAt: true
          }
        }
      }
    })

    if (!userWithPhotos || userWithPhotos.photos.length === 0) {
      console.log('❌ No users with photos found. Please ensure you have some test data.')
      return
    }

    const photo = userWithPhotos.photos[0]
    console.log(`📸 Testing with photo: ${photo.id}`)
    console.log(`🔑 Photo key: ${photo.key}`)
    console.log(`📅 Uploaded: ${photo.uploadedAt}`)

    // Test public URL
    const publicUrl = getPublicObjectUrl(photo.key)
    console.log(`🌐 Public URL: ${publicUrl}`)

    // Test presigned URL (7 days expiry)
    const presignedUrl = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7)
    console.log(`🔐 Presigned URL: ${presignedUrl}`)

    // Test the presigned URL with a HEAD request
    console.log('\n🧪 Testing presigned URL...')
    try {
      const response = await fetch(presignedUrl, { method: 'HEAD' })
      console.log(`✅ Status: ${response.status} ${response.statusText}`)
      console.log(`📏 Content-Length: ${response.headers.get('content-length') || 'unknown'}`)
      console.log(`📋 Content-Type: ${response.headers.get('content-type') || 'unknown'}`)
      
      if (response.ok) {
        console.log('🎉 Presigned URL is working correctly!')
      } else {
        console.log('⚠️  Presigned URL returned non-200 status')
      }
    } catch (error) {
      console.error('❌ Error testing presigned URL:', error)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await getPrisma().$disconnect()
  }
}

// Run the test
testPresignedUrls()
  .then(() => {
    console.log('\n✨ Test completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })
