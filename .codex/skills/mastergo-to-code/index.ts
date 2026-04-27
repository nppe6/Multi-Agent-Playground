/**
 * MasterGo to Code Skill
 *
 * 处理本地图片资源,智能分类并上传大图到 OSS
 * 前置步骤：使用 mcp__mastergo-magic-mcp__mcp__getDsl 获取设计稿 DSL，
 * 从 DSL 中提取图片 URL 并下载到 temp-mastergo/ 目录后，再执行此脚本。
 * - 小图（< threshold）保存到项目本地
 * - 大图（≥ threshold）上传到阿里云 OSS
 */

import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { classifyImages, copyFiles } from './imageProcessor'
import { batchUploadToOSS } from './ossUploader'
import type { UploadResult } from './ossUploader'

// 加载 .env.local 环境变量
config({ path: path.resolve(process.cwd(), '.env.local') })

interface ImageMapping {
  localImages: Array<{
    fileName: string
    path: string
    size: string
  }>
  ossImages: Array<{
    fileName: string
    cdnUrl: string
    size: string
  }>
}

/**
 * Skill 入口函数
 * @param args 命令行参数
 */
export async function execute(args: string[]) {
  console.log('🚀 图片资源处理 Skill 开始执行...\n')

  if (args.length === 0) {
    console.error('❌ 请提供图片路径')
    console.log('\n使用示例:')
    console.log('  npx tsx .claude/skills/mastergo-to-code/index.ts temp-mastergo/')
    console.log('  npx tsx .claude/skills/mastergo-to-code/index.ts temp-mastergo/*.png')
    console.log('  npx tsx .claude/skills/mastergo-to-code/index.ts bg.png --threshold 100')
    process.exit(1)
  }

  // 解析参数
  const options = parseArgs(args)
  const { imagePath, threshold, localDir } = options

  console.log('📋 配置信息:')
  console.log(`  图片路径: ${imagePath}`)
  console.log(`  大小阈值: ${threshold} KB`)
  console.log(`  本地目录: ${localDir}\n`)

  // 收集图片文件
  const imageFiles = collectImageFiles(imagePath)
  if (imageFiles.length === 0) {
    console.error('❌ 未找到图片文件')
    process.exit(1)
  }

  console.log(`📦 找到 ${imageFiles.length} 个图片文件\n`)

  // 处理图片
  const result = await processImages(imageFiles, { threshold, localDir })

  // 输出结果
  console.log('\n✅ 处理完成!')
  console.log('\n📄 图片映射表:')
  console.log(JSON.stringify(result, null, 2))

  return result
}

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]) {
  let imagePath = ''
  let threshold = 50
  let localDir = path.join(process.cwd(), 'src/static/images')

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--threshold' && args[i + 1]) {
      threshold = Number.parseInt(args[i + 1], 10)
      i++
    }
    else if (arg === '--localDir' && args[i + 1]) {
      localDir = path.resolve(process.cwd(), args[i + 1])
      i++
    }
    else if (!arg.startsWith('--')) {
      imagePath = arg
    }
  }

  return { imagePath, threshold, localDir }
}

/**
 * 收集图片文件
 */
function collectImageFiles(inputPath: string): string[] {
  const absolutePath = path.resolve(process.cwd(), inputPath)
  const files: string[] = []

  // 检查是否存在
  if (!fs.existsSync(absolutePath)) {
    return files
  }

  const stat = fs.statSync(absolutePath)

  if (stat.isFile()) {
    // 单个文件
    if (isImageFile(absolutePath)) {
      files.push(absolutePath)
    }
  }
  else if (stat.isDirectory()) {
    // 目录 - 递归收集
    const entries = fs.readdirSync(absolutePath)
    for (const entry of entries) {
      const fullPath = path.join(absolutePath, entry)
      const entryStat = fs.statSync(fullPath)

      if (entryStat.isFile() && isImageFile(fullPath)) {
        files.push(fullPath)
      }
    }
  }

  return files
}

/**
 * 判断是否为图片文件
 */
function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)
}

/**
 * 处理图片资源
 * @param imagePaths 图片路径数组
 * @param options 处理选项
 */
export async function processImages(
  imagePaths: string[],
  options: {
    threshold?: number
    localDir?: string
  } = {},
): Promise<ImageMapping> {
  const {
    threshold = 50,
    localDir = path.join(process.cwd(), 'src/static/images'),
  } = options

  console.log('📦 开始分类图片...')

  // 分类图片
  const classification = classifyImages(imagePaths, threshold)

  console.log(`  小图: ${classification.localImages.length} 个`)
  console.log(`  大图: ${classification.ossImages.length} 个\n`)

  // 处理本地图片
  const localImagePaths = classification.localImages.map(img => img.filePath)
  if (localImagePaths.length > 0) {
    console.log('📁 复制小图到本地目录...')
    copyFiles(localImagePaths, localDir)
  }

  // 处理 OSS 图片
  let ossUploadResults: UploadResult[] = []
  if (classification.ossImages.length > 0) {
    console.log('☁️  上传大图到 OSS...')
    const ossImagePaths = classification.ossImages.map(img => img.filePath)
    ossUploadResults = await batchUploadToOSS(ossImagePaths)
  }

  // 构建结果映射
  const localImages = classification.localImages.map(img => ({
    fileName: img.fileName,
    path: path.join(localDir, img.fileName),
    size: `${img.sizeInKB} KB`,
  }))

  const ossImages = ossUploadResults
    .filter(r => r.success)
    .map((r) => {
      const fileName = path.basename(r.localPath)
      const originalImg = classification.ossImages.find(img => img.fileName === fileName)
      return {
        fileName,
        cdnUrl: r.cdnUrl || r.ossUrl || '',
        size: originalImg ? `${originalImg.sizeInKB} KB` : 'unknown',
      }
    })

  return {
    localImages,
    ossImages,
  }
}

// 直接运行入口（ESM 无条件执行）
{
  const args = process.argv.slice(2)
  execute(args)
    .then((result) => {
      console.log('\n✅ 处理完成:')
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ 执行失败:', error.message)
      process.exit(1)
    })
}
