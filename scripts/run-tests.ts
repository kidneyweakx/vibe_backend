#!/usr/bin/env bun

import { spawn } from 'bun'
import { existsSync, unlinkSync, copyFileSync } from 'fs'

const args = process.argv.slice(2)
const command = args[0] || 'all'

// 清理舊的測試數據庫
function cleanupTestDb() {
  if (existsSync('test.db')) {
    console.log('🧹 清理舊的測試數據庫...')
    unlinkSync('test.db')
  }
}

// 設置測試數據庫
async function setupTestDb() {
  console.log('🔧 設置測試數據庫...')
  
  // 創建測試數據庫 schema
  const pushResult = await spawn({
    cmd: ['npx', 'prisma', 'db', 'push', '--force-reset', '--schema', 'tests/schema.test.prisma'],
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db'
    },
    stdio: ['inherit', 'inherit', 'inherit']
  })
  
  if (pushResult.exitCode !== 0) {
    console.warn('⚠️ Prisma push returned non-zero. Falling back to copy prisma/dev.db → test.db')
    try {
      copyFileSync('prisma/dev.db', 'test.db')
      console.log('✅ test.db created by copying prisma/dev.db')
    } catch (e) {
      console.error('❌ 測試數據庫設置失敗')
      process.exit(1)
    }
  }
  
  console.log('✅ 測試數據庫設置完成')
}

// 運行測試
async function runTests(pattern?: string) {
  console.log('🧪 運行測試...')
  
  const testArgs = ['test']
  
  if (pattern) {
    testArgs.push(pattern)
  }
  
  // 添加其他測試選項
  if (args.includes('--watch')) {
    testArgs.push('--watch')
  }
  
  if (args.includes('--coverage')) {
    testArgs.push('--coverage')
  }
  
  if (args.includes('--verbose')) {
    testArgs.push('--verbose')
  }
  
  // Optional: seed fake data into test DB before running
  if (args.includes('--seed-fake')) {
    console.log('🌱 Seeding fake data into test database...')
    const seedResult = await spawn({
      cmd: ['bun', 'run', 'tests/seedFakeData.ts'],
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      stdio: ['inherit', 'inherit', 'inherit']
    })
    if (seedResult.exitCode !== 0) {
      console.error('❌ Failed to seed fake data')
      return seedResult.exitCode
    }
  }
  
  const testResult = await spawn({
    cmd: ['bun', ...testArgs],
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test'
    },
    stdio: ['inherit', 'inherit', 'inherit']
  })
  
  return testResult.exitCode
}

// 主函數
async function main() {
  console.log('🚀 開始測試流程...\n')
  
  try {
    // 清理和設置測試環境
    cleanupTestDb()
    await setupTestDb()
    
    let exitCode = 0
    
    switch (command) {
      case 'all':
        console.log('📋 運行所有測試')
        exitCode = await runTests()
        break
        
      case 'unit':
        console.log('🔬 運行單元測試')
        exitCode = await runTests('tests/*.service.test.ts')
        break
        
      case 'api':
        console.log('🌐 運行 API 測試')
        exitCode = await runTests('tests/*.api.test.ts')
        break
        
      case 'integration':
        console.log('🔗 運行整合測試')
        exitCode = await runTests('tests/integration.test.ts')
        break
        
      case 'tag':
        console.log('🏷️ 運行標籤相關測試')
        exitCode = await runTests('tests/tag.*.test.ts')
        break
        
      case 'photo':
        console.log('📸 運行照片相關測試')
        exitCode = await runTests('tests/photo.*.test.ts')
        break
      
      case 'services':
        console.log('🧩 Run services tests')
        exitCode = await runTests('tests/services')
        break
        
      default:
        if (command.endsWith('.test.ts')) {
          console.log(`🎯 運行特定測試: ${command}`)
          exitCode = await runTests(`tests/${command}`)
        } else {
          console.log('❓ 未知的測試命令')
          console.log('\n可用命令:')
          console.log('  all         - 運行所有測試')
          console.log('  unit        - 運行單元測試')
          console.log('  api         - 運行 API 測試')
          console.log('  integration - 運行整合測試')
          console.log('  tag         - 運行標籤相關測試')
          console.log('  photo       - 運行照片相關測試')
          console.log('  services    - Run tests under tests/services')
          console.log('  <filename>  - 運行特定測試文件')
          console.log('\n選項:')
          console.log('  --watch     - 監視模式')
          console.log('  --coverage  - 生成覆蓋率報告')
          console.log('  --verbose   - 詳細輸出')
          console.log('  --seed-fake - Seed fake data before tests')
          process.exit(1)
        }
    }
    
    // 清理測試數據庫（除非是監視模式）
    if (!args.includes('--watch')) {
      cleanupTestDb()
    }
    
    if (exitCode === 0) {
      console.log('\n✅ 所有測試通過！')
    } else {
      console.log('\n❌ 測試失敗')
    }
    
    process.exit(exitCode)
    
  } catch (error) {
    console.error('💥 測試運行出錯:', error)
    cleanupTestDb()
    process.exit(1)
  }
}

// 處理中斷信號
process.on('SIGINT', () => {
  console.log('\n🛑 測試被中斷')
  cleanupTestDb()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 測試被終止')
  cleanupTestDb()
  process.exit(0)
})

main()