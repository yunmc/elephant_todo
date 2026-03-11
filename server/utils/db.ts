import mysql from 'mysql2/promise'
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import * as schema from '../database/schema'

let _pool: mysql.Pool | null = null
let _db: MySql2Database<typeof schema> | null = null

/**
 * 获取 MySQL 连接池（单例）
 */
export function getPool(): mysql.Pool {
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
      connectTimeout: 10000,
      enableKeepAlive: true,
    })
  }
  return _pool
}

/**
 * 获取 Drizzle ORM 实例（单例）
 */
export function getDb(): MySql2Database<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema, mode: 'default' })
  }
  return _db
}

/**
 * 获取原始 MySQL 连接池（兼容旧代码）
 * @deprecated 请使用 getDb() 获取 Drizzle 实例
 */
export function getRawDb(): mysql.Pool {
  return getPool()
}
