/**
 * OSS 上传测试 Demo
 *
 * 用于测试阿里云 OSS 上传功能
 *
 * 使用方法:
 * 1. 复制 .env.example 为 .env.local 并填入真实的 OSS 配置
 * 2. 将要测试的图片放到项目根目录（或先用 mcp__mastergo-magic-mcp__mcp__getDsl 下载到 temp-mastergo/）
 * 3. 运行: pnpm tsx .claude/skills/mastergo-to-code/demo.ts <图片路径>
 *
 * 示例:
 *   pnpm tsx .claude/skills/mastergo-to-code/demo.ts public/profile-background-8d9743.png
 */

import path from 'node:path'
import { batchUploadToOSS, uploadToOSS } from './ossUploader'
import { bytesToKB, classifyImages, getFileSize } from './imageProcessor'

async function testSingleUpload(filePath: string) {
  console.log('\n=== 测试单文件上传 ===\n')

  const absolutePath = path.resolve(process.cwd(), filePath)
  console.log(`文件路径: ${absolutePath}`)
  console.log(`文件大小: ${bytesToKB(getFileSize(absolutePath))} KB\n`)

  console.log('开始上传...')
  const result = await uploadToOSS(absolutePath)

  if (result.success) {
    console.log('\n✅ 上传成功!')
    console.log(`  OSS Key: ${result.ossKey}`)
    console.log(`  OSS URL: ${result.ossUrl}`)
    console.log(`  CDN URL: ${result.cdnUrl}`)
  }
  else {
    console.log('\n❌ 上传失败!')
    console.error('  错误信息:', result.error)
  }

  return result
}

async function testBatchUpload(filePaths: string[]) {
  console.log('\n=== 测试批量上传 ===\n')

  const absolutePaths = filePaths.map(p => path.resolve(process.cwd(), p))
  console.log(`文件数量: ${absolutePaths.length}`)

  for (const filePath of absolutePaths) {
    console.log(`  - ${path.basename(filePath)} (${bytesToKB(getFileSize(filePath))} KB)`)
  }

  console.log('\n开始批量上传...')
  const results = await batchUploadToOSS(absolutePaths)

  console.log('\n上传结果:')
  results.forEach((result, index) => {
    const fileName = path.basename(result.localPath)
    if (result.success) {
      console.log(`  ✅ ${fileName}`)
      console.log(`     CDN: ${result.cdnUrl}`)
    }
    else {
      console.log(`  ❌ ${fileName}`)
      console.error(`     错误: ${result.error?.message || '未知错误'}`)
    }
  })

  return results
}

async function testClassifyAndUpload(filePaths: string[], thresholdKB: number = 50) {
  console.log('\n=== 测试分类与上传 ===\n')

  const absolutePaths = filePaths.map(p => path.resolve(process.cwd(), p))

  // 分类图片
  const classification = classifyImages(absolutePaths, thresholdKB)

  // 只上传大图
  if (classification.ossImages.length > 0) {
    console.log(`\n上传 ${classification.ossImages.length} 个大图到 OSS...`)
    const ossImagePaths = classification.ossImages.map(img => img.filePath)
    const results = await batchUploadToOSS(ossImagePaths)

    console.log('\n上传结果:')
    results.forEach((result) => {
      const fileName = path.basename(result.localPath)
      if (result.success) {
        console.log(`  ✅ ${fileName} → ${result.cdnUrl}`)
      }
      else {
        console.log(`  ❌ ${fileName} → 上传失败`)
      }
    })

    return results
  }
  else {
    console.log('\n没有需要上传到 OSS 的大图')
    return []
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('❌ 请提供图片路径')
    console.log('\n使用示例:')
    console.log('  pnpm tsx .claude/skills/mastergo-to-code/demo.ts public/profile-background-8d9743.png')
    console.log('  pnpm tsx .claude/skills/mastergo-to-code/demo.ts public/*.png')
    console.log('  pnpm tsx .claude/skills/mastergo-to-code/demo.ts --classify public/*.png')
    process.exit(1)
  }

  try {
    // 检查配置
    console.log('📋 检查 OSS 配置...')
    const { loadOSSConfig } = await import('./ossConfig')
    const config = loadOSSConfig()
    console.log(`  ✓ Region: ${config.region}`)
    console.log(`  ✓ Bucket: ${config.bucket}`)
    console.log(`  ✓ CDN Domain: ${config.cdnDomain || '(未配置)'}`)

    // 选择测试模式
    if (args[0] === '--classify') {
      // 分类模式
      const filePaths = args.slice(1)
      await testClassifyAndUpload(filePaths)
    }
    else if (args.length === 1) {
      // 单文件上传
      await testSingleUpload(args[0])
    }
    else {
      // 批量上传
      await testBatchUpload(args)
    }

    console.log('\n✅ 测试完成')
  }
  catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
    if (error.message.includes('缺少 OSS 配置')) {
      console.log('\n请先配置 OSS:')
      console.log('  1. 复制 .env.example 为 .env.local')
      console.log('  2. 填入真实的 OSS 配置信息')
    }
    process.exit(1)
  }
}

// 运行
main()
