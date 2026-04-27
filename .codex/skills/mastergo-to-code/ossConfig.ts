import * as Minio from 'minio'

/**
 * MinIO 配置接口
 */
export interface OSSConfig {
  endPoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucket: string
  cdnDomain?: string
  pathPrefix?: string
}

/**
 * 从环境变量加载 MinIO 配置
 * OSS_CDN_DOMAIN 同时作为 endpoint 和 CDN 域名使用
 */
export function loadOSSConfig(): OSSConfig {
  const rawEndpoint = process.env.OSS_CDN_DOMAIN || 'http://127.0.0.1:9000'
  const url = new URL(rawEndpoint)

  const config: OSSConfig = {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
    useSSL: url.protocol === 'https:',
    accessKey: process.env.OSS_ACCESS_KEY_ID || '',
    secretKey: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    cdnDomain: rawEndpoint,
    pathPrefix: process.env.OSS_PATH_PREFIX || 'mastergo-assets',
  }

  if (!config.accessKey || !config.secretKey || !config.bucket) {
    throw new Error(
      '缺少 MinIO 配置，请在 .env.local 中配置 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET 和 OSS_BUCKET',
    )
  }

  return config
}

/**
 * 创建 MinIO 客户端实例
 */
export function createOSSClient(config?: OSSConfig): Minio.Client {
  const c = config || loadOSSConfig()
  return new Minio.Client({
    endPoint: c.endPoint,
    port: c.port,
    useSSL: c.useSSL,
    accessKey: c.accessKey,
    secretKey: c.secretKey,
  })
}

/**
 * 获取 CDN 域名（即 MinIO 服务地址）
 */
export function getCDNDomain(): string {
  return process.env.OSS_CDN_DOMAIN || ''
}

/**
 * 获取存储路径前缀
 */
export function getOSSPathPrefix(): string {
  return process.env.OSS_PATH_PREFIX || 'mastergo-assets'
}
