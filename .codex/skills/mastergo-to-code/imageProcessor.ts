import fs from 'node:fs'
import path from 'node:path'

/**
 * 图片信息
 */
export interface ImageInfo {
  filePath: string
  fileName: string
  size: number
  sizeInKB: number
  needUploadToOSS: boolean
}

/**
 * 图片分类结果
 */
export interface ImageClassificationResult {
  localImages: ImageInfo[]
  ossImages: ImageInfo[]
  totalCount: number
  totalSize: number
}

/**
 * 获取文件大小（字节）
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath)
    return stats.size
  }
  catch (error) {
    console.error(`获取文件大小失败 [${filePath}]:`, error)
    return 0
  }
}

/**
 * 将字节转换为 KB
 */
export function bytesToKB(bytes: number): number {
  return Math.round((bytes / 1024) * 100) / 100
}

/**
 * 将 KB 字符串转换为字节（支持 "50KB" 格式）
 */
export function parseKBToBytes(size: string | number): number {
  if (typeof size === 'number') {
    return size * 1024
  }

  const match = size.match(/^(\d+(?:\.\d+)?)\s*(?:KB)?$/i)
  if (!match) {
    throw new Error(`无效的大小格式: ${size}`)
  }

  return Number.parseFloat(match[1]) * 1024
}

/**
 * 获取图片信息
 */
export function getImageInfo(filePath: string, threshold: number): ImageInfo {
  const size = getFileSize(filePath)
  const sizeInKB = bytesToKB(size)
  const fileName = path.basename(filePath)

  return {
    filePath,
    fileName,
    size,
    sizeInKB,
    needUploadToOSS: size >= threshold,
  }
}

/**
 * 分类图片（根据大小阈值）
 * @param imagePaths 图片路径数组
 * @param thresholdKB 大小阈值（KB），超过此值的图片需要上传到 OSS
 * @returns 分类结果
 */
export function classifyImages(
  imagePaths: string[],
  thresholdKB: number = 50,
): ImageClassificationResult {
  const threshold = parseKBToBytes(thresholdKB)

  const localImages: ImageInfo[] = []
  const ossImages: ImageInfo[] = []
  let totalSize = 0

  for (const imagePath of imagePaths) {
    const imageInfo = getImageInfo(imagePath, threshold)
    totalSize += imageInfo.size

    if (imageInfo.needUploadToOSS) {
      ossImages.push(imageInfo)
    }
    else {
      localImages.push(imageInfo)
    }
  }

  console.log(`\n📊 图片分类结果:`)
  console.log(`  总数: ${imagePaths.length} 个`)
  console.log(`  本地存储: ${localImages.length} 个 (< ${thresholdKB}KB)`)
  console.log(`  OSS 存储: ${ossImages.length} 个 (≥ ${thresholdKB}KB)`)
  console.log(`  总大小: ${bytesToKB(totalSize)} KB\n`)

  return {
    localImages,
    ossImages,
    totalCount: imagePaths.length,
    totalSize,
  }
}

/**
 * 确保目录存在
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * 复制文件到目标目录
 */
export function copyFile(sourcePath: string, targetDir: string): string {
  ensureDir(targetDir)
  const fileName = path.basename(sourcePath)
  const targetPath = path.join(targetDir, fileName)
  fs.copyFileSync(sourcePath, targetPath)
  console.log(`  ✓ 复制: ${fileName} → ${targetPath}`)
  return targetPath
}

/**
 * 批量复制文件
 */
export function copyFiles(sourcePaths: string[], targetDir: string): string[] {
  console.log(`\n📁 复制 ${sourcePaths.length} 个文件到 ${targetDir}...`)
  return sourcePaths.map(sourcePath => copyFile(sourcePath, targetDir))
}

/**
 * 清理临时文件
 */
export function cleanupTempFiles(filePaths: string[]): void {
  console.log(`\n🧹 清理 ${filePaths.length} 个临时文件...`)
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`  ✓ 删除: ${path.basename(filePath)}`)
      }
    }
    catch (error) {
      console.error(`  ✗ 删除失败 [${filePath}]:`, error)
    }
  }
}
