import {DbAdapter} from "./adapter.js";
import {validateForbiddenOperations} from "./sql-validator.js";
import pg from 'pg';

/**
 * PostgreSQL 数据库适配器实现
 */
export class PostgresqlAdapter implements DbAdapter {
    private client: pg.Client | null = null;
    private config: pg.ClientConfig;
    private host: string;
    private database: string;

    constructor(connectionInfo: {
        host: string;
        database: string;
        user?: string;
        password?: string;
        port?: number;
        ssl?: boolean | object;
        options?: any;
        connectionTimeout?: number;
    }) {
        this.host = connectionInfo.host;
        this.database = connectionInfo.database;

        // 创建 PostgreSQL 连接配置
        this.config = {
            host: connectionInfo.host,
            database: connectionInfo.database,
            port: connectionInfo.port || 5432,
            user: connectionInfo.user,
            password: connectionInfo.password,
            ssl: connectionInfo.ssl,
            // 如果提供了连接超时,则添加(以毫秒为单位)
            connectionTimeoutMillis: connectionInfo.connectionTimeout || 30000,
        };
    }

    /**
     * 初始化 PostgreSQL 连接
     */
    async init(): Promise<void> {
        try {
            console.error(`[INFO] 正在连接 PostgreSQL: ${this.host}, 数据库: ${this.database}`);
            console.error(`[DEBUG] Connection details:`, {
                host: this.host,
                database: this.database,
                port: this.config.port,
                user: this.config.user,
                connectionTimeoutMillis: this.config.connectionTimeoutMillis,
                ssl: !!this.config.ssl
            });

            this.client = new pg.Client(this.config);
            await this.client.connect();
            console.error(`[INFO] PostgreSQL 连接成功建立`);
        } catch (err) {
            console.error(`[ERROR] PostgreSQL 连接错误: ${(err as Error).message}`);
            throw new Error(`连接 PostgreSQL 失败: ${(err as Error).message}`);
        }
    }

    /**
     * 执行 SQL 查询并获取所有结果
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     * @returns 包含查询结果的 Promise
     */
    async all(query: string, params: any[] = []): Promise<any[]> {
        if (!this.client) {
            throw new Error("数据库未初始化");
        }

        try {
            // PostgreSQL 使用 $1, $2 等作为参数化查询的占位符
            let paramIndex = 0;
            const preparedQuery = query.replace(/\?/g, () => `$${++paramIndex}`);

            const result = await this.client.query(preparedQuery, params);
            return result.rows;
        } catch (err) {
            throw new Error(`PostgreSQL 查询错误: ${(err as Error).message}`);
        }
    }

    /**
     * 执行修改数据的 SQL 查询
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     * @returns 包含结果信息的 Promise
     */
    async run(query: string, params: any[] = []): Promise<{ changes: number, lastID: number }> {
        if (!this.client) {
            throw new Error("数据库未初始化");
        }

        // 验证禁用的操作
        validateForbiddenOperations(query);

        try {
            // 将 ? 替换为编号参数
            let paramIndex = 0;
            const preparedQuery = query.replace(/\?/g, () => `$${++paramIndex}`);

            let lastID = 0;
            let changes = 0;

            // 对于 INSERT 查询,尝试获取插入的 ID
            if (query.trim().toUpperCase().startsWith('INSERT')) {
                // 如果查询中没有 RETURNING 子句,则添加以获取插入的 ID
                const returningQuery = preparedQuery.includes('RETURNING')
                    ? preparedQuery
                    : `${preparedQuery} RETURNING id`;

                const result = await this.client.query(returningQuery, params);
                changes = result.rowCount || 0;
                lastID = result.rows[0]?.id || 0;
            } else {
                const result = await this.client.query(preparedQuery, params);
                changes = result.rowCount || 0;
            }

            return {changes, lastID};
        } catch (err) {
            throw new Error(`PostgreSQL 查询错误: ${(err as Error).message}`);
        }
    }

    /**
     * 执行多条 SQL 语句
     * @param query 要执行的 SQL 语句
     * @returns 执行完成后解析的 Promise
     */
    async exec(query: string): Promise<void> {
        if (!this.client) {
            throw new Error("数据库未初始化");
        }

        // 验证禁用的操作
        validateForbiddenOperations(query);

        try {
            await this.client.query(query);
        } catch (err) {
            throw new Error(`PostgreSQL 批处理错误: ${(err as Error).message}`);
        }
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        if (this.client) {
            await this.client.end();
            this.client = null;
        }
    }

    /**
     * 获取数据库元数据
     */
    getMetadata(): { name: string, type: string, server: string, database: string } {
        return {
            name: "PostgreSQL",
            type: "postgresql",
            server: this.host,
            database: this.database
        };
    }

    /**
     * 获取用于列出表的数据库特定查询
     */
    getListTablesQuery(): string {
        return "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    }

    /**
     * 获取用于描述表结构的数据库特定查询
     * @param tableName 表名
     */
    getDescribeTableQuery(tableName: string): string {
        return `
      SELECT
        c.column_name as name,
        c.data_type as type,
        CASE WHEN c.is_nullable = 'NO' THEN 1 ELSE 0 END as notnull,
        CASE WHEN pk.constraint_name IS NOT NULL THEN 1 ELSE 0 END as pk,
        c.column_default as dflt_value,
        pgd.description AS comment
      FROM
        information_schema.columns c
      LEFT JOIN
        information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN
        information_schema.table_constraints pk
        ON kcu.constraint_name = pk.constraint_name AND pk.constraint_type = 'PRIMARY KEY'
      LEFT JOIN
        pg_catalog.pg_class pgc
        ON pgc.relname = c.table_name
      LEFT JOIN
        pg_catalog.pg_attribute pga
        ON pga.attrelid = pgc.oid AND pga.attname = c.column_name
      LEFT JOIN
        pg_catalog.pg_description pgd
        ON pgd.objoid = pgc.oid AND pgd.objsubid = pga.attnum
      WHERE
        c.table_name = '${tableName}'
        AND c.table_schema = 'public'
      ORDER BY
        c.ordinal_position
    `;
    }
} 