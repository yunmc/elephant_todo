import mysql from 'mysql2/promise'

let _pool: mysql.Pool | null = null

/**
 * 获取 MySQL 连接池（单例）
 */
export function getDb(): mysql.Pool {
  if (!_pool) {
    const config = useRuntimeConfig()
    _pool = mysql.createPool({
      host: config.dbHost as string,
      port: Number(config.dbPort),
      user: config.dbUser as string,
      password: config.dbPassword as string,
      database: config.dbName as string,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    })
  }
  return _pool
}
