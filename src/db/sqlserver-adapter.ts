import {DbAdapter} from "./adapter.js";
import sql from 'mssql';

/**
 * 验证并转义 SQL Server 标识符名称
 * 防止 SQL 注入攻击
 * @param name 标识符名称（表名、视图名、存储过程名等）
 * @returns 转义后的安全标识符
 * @throws 如果标识符包含非法字符
 */
function escapeIdentifier(name: string): string {
    // 检查名称是否为空
    if (!name || typeof name !== 'string') {
        throw new Error('标识符名称不能为空');
    }

    // 检查名称长度（SQL Server 限制为 128 字符）
    if (name.length > 128) {
        throw new Error('标识符名称长度超过限制（最大 128 字符）');
    }

    // 检查是否包含危险的 SQL 字符
    // 只允许字母、数字、下划线和常见的安全字符
    const validNamePattern = /^[a-zA-Z_][a-zA-Z0-9_@$#]*$/;
    if (!validNamePattern.test(name)) {
        throw new Error(`标识符名称包含非法字符: ${name.substring(0, 20)}...`);
    }

    // 使用方括号转义标识符
    // 方括号内的右方括号需要转义为两个右方括号
    return `[${name.replace(/]/g, ']]')}]`;
}

/**
 * SQL Server 数据库适配器实现
 */
export class SqlServerAdapter implements DbAdapter {
    private pool: sql.ConnectionPool | null = null;
    private config: sql.config;
    private server: string;
    private database: string;
    private isConnecting: boolean = false;

    constructor(connectionInfo: {
        server: string;
        database: string;
        user?: string;
        password?: string;
        port?: number;
        trustServerCertificate?: boolean;
        options?: any;
    }) {
        this.server = connectionInfo.server;
        this.database = connectionInfo.database;

        // 创建 SQL Server 连接配置
        this.config = {
            server: connectionInfo.server,
            database: connectionInfo.database,
            port: connectionInfo.port || 1433,
            // 连接池配置
            pool: {
                max: 10,              // 最大连接数
                min: 1,               // 最小连接数
                idleTimeoutMillis: 30000,  // 空闲连接超时时间 (30秒)
            },
            // 连接超时和请求超时配置
            connectionTimeout: 30000,    // 连接超时 (30秒)
            requestTimeout: 30000,       // 请求超时 (30秒)
            options: {
                trustServerCertificate: connectionInfo.trustServerCertificate ?? true,
                enableArithAbort: true,
                ...connectionInfo.options
            }
        };

        // 添加认证选项
        if (connectionInfo.user && connectionInfo.password) {
            this.config.user = connectionInfo.user;
            this.config.password = connectionInfo.password;
        } else {
            // 如果未提供用户名/密码,则使用 Windows 身份验证
            this.config.options!.trustedConnection = true;
        }
    }

    /**
     * 初始化 SQL Server 连接
     */
    async init(): Promise<void> {
        await this.ensureConnection();
    }

    /**
     * 确保连接可用，如果连接断开则自动重连
     */
    private async ensureConnection(): Promise<sql.ConnectionPool> {
        // 如果正在连接中，等待连接完成
        if (this.isConnecting) {
            await this.waitForConnection();
            if (this.pool && this.pool.connected) {
                return this.pool;
            }
        }

        // 检查现有连接是否可用
        if (this.pool && this.pool.connected) {
            return this.pool;
        }

        // 需要建立新连接
        this.isConnecting = true;
        try {
            // 如果存在旧的连接池，先关闭它
            if (this.pool) {
                try {
                    await this.pool.close();
                } catch (closeErr) {
                    console.error(`[WARN] 关闭旧连接池时出错: ${(closeErr as Error).message}`);
                }
                this.pool = null;
            }

            console.error(`[INFO] 正在连接 SQL Server: ${this.server}, 数据库: ${this.database}`);

            const pool = new sql.ConnectionPool(this.config);

            // 使用单次监听器防止内存泄漏
            pool.once('error', (err) => {
                console.error(`[ERROR] SQL Server 连接池错误: ${err.message}`);
                // 标记连接池为不可用，下次查询时会自动重连
                if (this.pool === pool) {
                    this.pool = null;
                }
            });

            this.pool = await pool.connect();
            console.error(`[INFO] SQL Server 连接成功建立`);
            return this.pool;
        } catch (err) {
            this.pool = null;
            console.error(`[ERROR] SQL Server 连接错误: ${(err as Error).message}`);
            throw new Error(`连接 SQL Server 失败: ${(err as Error).message}`);
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * 等待正在进行的连接完成
     */
    private async waitForConnection(): Promise<void> {
        const maxWait = 30000; // 最大等待30秒
        const interval = 100;  // 每100ms检查一次
        let waited = 0;

        while (this.isConnecting && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, interval));
            waited += interval;
        }

        // 如果超时，重置状态并抛出错误
        if (this.isConnecting) {
            this.isConnecting = false;
            throw new Error('连接超时');
        }
    }

    /**
     * 执行带重试的操作
     */
    private async executeWithRetry<T>(operation: (pool: sql.ConnectionPool) => Promise<T>, retries: number = 2): Promise<T> {
        let lastError: Error | null = null;
        let poolAcquired = false;  // 标记是否已成功获取连接池

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const pool = await this.ensureConnection();
                poolAcquired = true;  // 成功获取连接池
                return await operation(pool);
            } catch (err) {
                lastError = err as Error;
                const errorMessage = lastError.message.toLowerCase();

                // 检查是否是连接相关的错误
                const isConnectionError =
                    errorMessage.includes('connection') ||
                    errorMessage.includes('socket') ||
                    errorMessage.includes('timeout') ||
                    errorMessage.includes('closed') ||
                    errorMessage.includes('econnreset') ||
                    errorMessage.includes('econnrefused') ||
                    errorMessage.includes('network') ||
                    errorMessage.includes('failed to connect');

                // 只有在获取连接池后（即 poolAcquired = true）发生的连接错误才重试
                // ensureConnection 本身的错误（如认证失败、连接超时）不应重试
                if (isConnectionError && poolAcquired && attempt < retries && this.pool !== null) {
                    console.error(`[WARN] 检测到连接错误，正在尝试重新连接 (尝试 ${attempt + 1}/${retries}): ${lastError.message}`);
                    this.pool = null;
                    poolAcquired = false;  // 重置标记
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }

                throw lastError;
            }
        }

        throw lastError;
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        // 等待正在进行的连接完成
        if (this.isConnecting) {
            await this.waitForConnection();
        }

        if (this.pool) {
            try {
                await this.pool.close();
            } catch (err) {
                console.error(`[WARN] 关闭连接池时出错: ${(err as Error).message}`);
            }
            this.pool = null;
        }

        this.isConnecting = false;
    }

    /**
     * 执行 SQL 查询并获取所有结果
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     * @returns 包含查询结果的 Promise
     */
    async all(query: string, params: any[] = []): Promise<any[]> {
        return this.executeWithRetry(async (pool) => {
            const request = pool.request();

            // 向请求添加参数
            params.forEach((param, index) => {
                request.input(`param${index}`, param);
            });

            // 将 ? 替换为命名参数
            let paramIndex = 0;
            const preparedQuery = query.replace(/\?/g, () => `@param${paramIndex++}`);

            const result = await request.query(preparedQuery);
            return result.recordset;
        });
    }

    /**
     * 执行修改数据的 SQL 查询
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     * @returns 包含结果信息的 Promise
     */
    async run(query: string, params: any[] = []): Promise<{ changes: number, lastID: number }> {
        // 检查是否为 TRUNCATE 操作（已被禁用）
        const upperQuery = query.trim().toUpperCase();
        if (upperQuery.startsWith('TRUNCATE')) {
            throw new Error('TRUNCATE 操作已被禁用，因为它不可回滚且不触发触发器');
        }

        return this.executeWithRetry(async (pool) => {
            const request = pool.request();

            // 向请求添加参数
            params.forEach((param, index) => {
                request.input(`param${index}`, param);
            });

            // 将 ? 替换为命名参数
            let paramIndex = 0;
            const preparedQuery = query.replace(/\?/g, () => `@param${paramIndex++}`);

            // 如果是 INSERT,添加标识值的输出参数
            let lastID = 0;
            let changes = 0;
            if (query.trim().toUpperCase().startsWith('INSERT')) {
                request.output('insertedId', sql.Int, 0);
                const updatedQuery = `${preparedQuery}; SELECT @insertedId = SCOPE_IDENTITY();`;
                const result = await request.query(updatedQuery);
                lastID = result.output.insertedId || 0;
                // 使用 rowsAffected 获取受影响行数
                changes = result.rowsAffected?.[0] || (lastID > 0 ? 1 : 0);
            } else {
                const result = await request.query(preparedQuery);
                // 使用 rowsAffected 获取受影响行数
                changes = result.rowsAffected?.[0] || 0;
            }

            return {
                changes: changes,
                lastID: lastID
            };
        });
    }

    /**
     * 执行多条 SQL 语句
     * @param query 要执行的 SQL 语句
     * @returns 执行完成后解析的 Promise
     */
    async exec(query: string): Promise<void> {
        return this.executeWithRetry(async (pool) => {
            const request = pool.request();
            await request.batch(query);
        });
    }

    /**
     * 获取数据库元数据
     */
    getMetadata(): { name: string, type: string, server: string, database: string } {
        return {
            name: "SQL Server",
            type: "sqlserver",
            server: this.server,
            database: this.database
        };
    }

    /**
     * 获取列出表的数据库特定查询
     */
    getListTablesQuery(): string {
        return "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
    }

    /**
     * 获取描述表或视图的数据库特定查询
     * @param tableName 表名或视图名
     * @returns SQL 查询字符串
     */
    getDescribeTableQuery(tableName: string): string {
        // 验证并转义表名，防止 SQL 注入
        const escapedTableName = escapeIdentifier(tableName);
        return `
      SELECT
        c.COLUMN_NAME as name,
        c.DATA_TYPE as type,
        CASE WHEN c.IS_NULLABLE = 'NO' THEN 1 ELSE 0 END as notnull,
        CASE WHEN pk.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 1 ELSE 0 END as pk,
        c.COLUMN_DEFAULT as dflt_value,
        ep.value AS comment
      FROM
        INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON c.TABLE_NAME = kcu.TABLE_NAME AND c.COLUMN_NAME = kcu.COLUMN_NAME
      LEFT JOIN
        INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk ON kcu.CONSTRAINT_NAME = pk.CONSTRAINT_NAME AND pk.CONSTRAINT_TYPE = 'PRIMARY KEY'
      LEFT JOIN
        sys.extended_properties ep
          ON ep.major_id = (
            SELECT o.object_id
            FROM sys.objects o
            INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
            WHERE o.name = ${escapedTableName} AND s.name = c.TABLE_SCHEMA
            AND o.type IN ('U', 'V')
          )
          AND ep.minor_id = c.ORDINAL_POSITION
          AND ep.name = 'MS_Description'
      WHERE
        c.TABLE_NAME = ${escapedTableName}
      ORDER BY
        c.ORDINAL_POSITION
    `;
    }

    /**
     * 获取列出视图的数据库特定查询
     */
    getListViewsQuery(): string {
        return "SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_NAME";
    }

    /**
     * 获取视图定义的数据库特定查询
     * @param viewName 视图名
     * @returns SQL 查询字符串
     * 注意: 使用 WITH ENCRYPTION 创建的视图无法获取定义
     */
    getViewDefinitionQuery(viewName: string): string {
        // 验证并转义视图名，防止 SQL 注入
        const escapedViewName = escapeIdentifier(viewName);
        return `SELECT VIEW_DEFINITION as definition FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = ${escapedViewName}`;
    }

    /**
     * 检查数据库是否支持视图功能
     */
    supportsViews(): boolean {
        return true;
    }

    /**
     * 检查数据库是否支持存储过程功能
     */
    supportsProcedures(): boolean {
        return true;
    }

    /**
     * 获取列出存储过程的数据库特定查询
     */
    getListProceduresQuery(): string {
        return "SELECT ROUTINE_NAME as name FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME";
    }

    /**
     * 获取存储过程参数信息的查询
     * @param procedureName 存储过程名
     * @returns SQL 查询字符串
     */
    getDescribeProcedureQuery(procedureName: string): string {
        // 验证并转义存储过程名，防止 SQL 注入
        const escapedProcedureName = escapeIdentifier(procedureName);
        return `
      SELECT
        PARAMETER_NAME as name,
        DATA_TYPE +
            CASE
                WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')'
                ELSE ''
            END as type,
        PARAMETER_MODE as direction,
        CASE WHEN PARAMETER_MODE IN ('OUT', 'INOUT') THEN 1 ELSE 0 END as is_output,
        NULL as default_value
      FROM INFORMATION_SCHEMA.PARAMETERS
      WHERE SPECIFIC_NAME = ${escapedProcedureName}
      ORDER BY ORDINAL_POSITION
    `;
    }

    /**
     * 获取存储过程定义的查询
     * @param procedureName 存储过程名
     * @returns SQL 查询字符串
     * 注意: 使用 WITH ENCRYPTION 创建的存储过程无法获取定义
     */
    getProcedureDefinitionQuery(procedureName: string): string {
        // 验证并转义存储过程名，防止 SQL 注入
        const escapedProcedureName = escapeIdentifier(procedureName);
        return `SELECT ROUTINE_DEFINITION as definition FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_NAME = ${escapedProcedureName}`;
    }
}
