import path from 'node:path'
import fs from 'node:fs'
import { createOSSClient, getCDNDomain, getOSSPathPrefix, loadOSSConfig } from './ossConfig'

/**
 * 上传结果
 */
export interface UploadResult {
  success: boolean
  localPath: string
  ossKey?: string
  ossUrl?: string
  cdnUrl?: string
  error?: any
}

/**
 * 上传选项
 */
export interface UploadOptions {
  /** 自定义 OSS 路径（相对于 bucket 根目录） */
  ossPath?: string
  /** 是否使用时间戳前缀 */
  useTimestamp?: boolean
  /** 上传进度回调 */
  onProgress?: (progress: number) => void
}

/**
 * 上传单个文件到 OSS
 * @param localFilePath 本地文件路径
 * @param options 上传选项
 */
export async function uploadToOSS(
  localFilePath: string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`文件不存在: ${localFilePath}`)
    }

    const client = createOSSClient()
    const config = loadOSSConfig()
    const fileName = path.basename(localFilePath)
    const pathPrefix = getOSSPathPrefix()

    // 生成存储路径
    let ossKey = options.ossPath
    if (!ossKey) {
      const timestamp = options.useTimestamp !== false ? `${Date.now()}-` : ''
      ossKey = `${pathPrefix}/${timestamp}${fileName}`
    }

    // 上传文件（MinIO putObject API）
    const fileStream = fs.createReadStream(localFilePath)
    const fileStat = fs.statSync(localFilePath)
    const mimeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    }
    const contentType = mimeMap[path.extname(localFilePath).toLowerCase()] || 'application/octet-stream'

    await client.putObject(config.bucket, ossKey, fileStream, fileStat.size, {
      'Content-Type': contentType,
    })

    // 拼接访问 URL：http://host:port/bucket/key
    const cdnDomain = getCDNDomain()
    const ossUrl = `${cdnDomain}/${config.bucket}/${ossKey}`

    return {
      success: true,
      localPath: localFilePath,
      ossKey,
      ossUrl,
      cdnUrl: ossUrl,
    }
  }
  catch (error) {
    console.error(`OSS 上传失败 [${localFilePath}]:`, error)
    return {
      success: false,
      localPath: localFilePath,
      error,
    }
  }
}

/**
 * 批量上传文件到 OSS
 * @param filePaths 本地文件路径数组
 * @param options 上传选项
 */
export async function batchUploadToOSS(
  filePaths: string[],
  options: UploadOptions = {},
): Promise<UploadResult[]> {
  console.log(`开始批量上传 ${filePaths.length} 个文件到 OSS...`)

  const results = await Promise.allSettled(
    filePaths.map(filePath => uploadToOSS(filePath, options)),
  )

  const uploadResults = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    else {
      return {
        success: false,
        localPath: filePaths[index],
        error: result.reason,
      }
    }
  })

  const successCount = uploadResults.filter(r => r.success).length
  console.log(`上传完成: ${successCount}/${filePaths.length} 成功`)

  return uploadResults
}

/**
 * 上传文件并返回 CDN URL（简化版）
 * @param localFilePath 本地文件路径
 * @returns CDN URL 或 null
 */
export async function uploadAndGetCDNUrl(localFilePath: string): Promise<string | null> {
  const result = await uploadToOSS(localFilePath)
  return result.success ? (result.cdnUrl || result.ossUrl || null) : null
}

/**
 * 删除 OSS 文件
 * @param ossKey OSS 文件路径
 */
export async function deleteFromOSS(ossKey: string): Promise<boolean> {
  try {
    const client = createOSSClient()
    const { bucket } = loadOSSConfig()
    await client.removeObject(bucket, ossKey)
    console.log(`已删除 MinIO 文件: ${ossKey}`)
    return true
  }
  catch (error) {
    console.error(`删除 OSS 文件失败 [${ossKey}]:`, error)
    return false
  }
}
