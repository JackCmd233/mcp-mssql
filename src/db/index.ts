import {DbAdapter, createDbAdapter} from './adapter.js';

// 存储活动的数据库适配器
let dbAdapter: DbAdapter | null = null;

/**
 * 初始化数据库连接
 * @param connectionInfo 连接信息对象或 SQLite 路径字符串
 * @param dbType 数据库类型 ('sqlite' 或 'sqlserver')
 */
export async function initDatabase(connectionInfo: any, dbType: string = 'sqlite'): Promise<void> {
    try {
        // 如果 connectionInfo 是字符串,则假定它是 SQLite 路径
        if (typeof connectionInfo === 'string') {
            connectionInfo = {path: connectionInfo};
        }

        // 根据数据库类型创建相应的适配器
        dbAdapter = createDbAdapter(dbType, connectionInfo);

        // 初始化连接
        await dbAdapter.init();
    } catch (error) {
        throw new Error(`数据库初始化失败: ${(error as Error).message}`);
    }
}

/**
 * 执行 SQL 查询并获取所有结果
 * @param query 要执行的 SQL 查询
 * @param params 查询参数
 * @returns 包含查询结果的 Promise
 */
export function dbAll(query: string, params: any[] = []): Promise<any[]> {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    return dbAdapter.all(query, params);
}

/**
 * 执行修改数据的 SQL 查询
 * @param query 要执行的 SQL 查询
 * @param params 查询参数
 * @returns 包含结果信息的 Promise
 */
export function dbRun(query: string, params: any[] = []): Promise<{ changes: number, lastID: number }> {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    return dbAdapter.run(query, params);
}

/**
 * 执行多条 SQL 语句
 * @param query 要执行的 SQL 语句
 * @returns 执行完成后解析的 Promise
 */
export function dbExec(query: string): Promise<void> {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    return dbAdapter.exec(query);
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): Promise<void> {
    if (!dbAdapter) {
        return Promise.resolve();
    }
    return dbAdapter.close();
}

/**
 * 获取数据库元数据
 */
export function getDatabaseMetadata(): {
    name: string,
    type: string,
    path?: string,
    server?: string,
    database?: string
} {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    return dbAdapter.getMetadata();
}

/**
 * 获取列出表的数据库特定查询
 */
export function getListTablesQuery(): string {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    return dbAdapter.getListTablesQuery();
}

/**
 * 获取描述表的数据库特定查询
 * @param tableName 表名
 */
export function getDescribeTableQuery(tableName: string): string {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    return dbAdapter.getDescribeTableQuery(tableName);
}

/**
 * 获取列出视图的数据库特定查询
 * 仅 SQL Server 支持
 * @returns SQL 查询字符串
 * @throws 如果数据库不支持视图功能
 */
export function getListViewsQuery(): string {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    if (dbAdapter.getListViewsQuery) {
        return dbAdapter.getListViewsQuery();
    }
    // 统一错误处理策略：不支持视图时抛出明确错误
    throw new Error("当前数据库不支持视图功能");
}

/**
 * 获取视图定义的数据库特定查询
 * 仅 SQL Server 支持
 * @param viewName 视图名
 */
export function getViewDefinitionQuery(viewName: string): string {
    if (!dbAdapter) {
        throw new Error("数据库未初始化");
    }
    if (dbAdapter.getViewDefinitionQuery) {
        return dbAdapter.getViewDefinitionQuery(viewName);
    }
    throw new Error("当前数据库不支持视图功能");
}

/**
 * 检查数据库是否支持视图功能
 */
export function supportsViews(): boolean {
    if (!dbAdapter) {
        return false;
    }
    return dbAdapter.supportsViews ? dbAdapter.supportsViews() : false;
}

/**
 * 检查存储过程功能是否可用
 * @returns 可用的数据库适配器
 * @throws 如果数据库未初始化或不支持存储过程功能
 */
function requireProcedureSupport(): DbAdapter {
    if (!dbAdapter) {
        throw new Error('数据库未初始化');
    }
    if (!dbAdapter.getListProceduresQuery) {
        throw new Error('当前数据库不支持存储过程功能');
    }
    return dbAdapter;
}

/**
 * 获取列出存储过程的查询
 * 仅 SQL Server 支持
 * @returns SQL 查询字符串
 * @throws 如果数据库不支持存储过程功能
 */
export function getListProceduresQuery(): string {
    return requireProcedureSupport().getListProceduresQuery!();
}

/**
 * 获取存储过程参数信息的查询
 * 仅 SQL Server 支持
 * @param procedureName 存储过程名
 * @returns SQL 查询字符串
 * @throws 如果数据库不支持存储过程功能
 */
export function getDescribeProcedureQuery(procedureName: string): string {
    return requireProcedureSupport().getDescribeProcedureQuery!(procedureName);
}

/**
 * 获取存储过程定义的查询
 * 仅 SQL Server 支持
 * @param procedureName 存储过程名
 * @returns SQL 查询字符串
 * @throws 如果数据库不支持存储过程功能
 */
export function getProcedureDefinitionQuery(procedureName: string): string {
    return requireProcedureSupport().getProcedureDefinitionQuery!(procedureName);
}

/**
 * 检查数据库是否支持存储过程功能
 * @returns 如果支持返回 true，否则返回 false
 */
export function supportsProcedures(): boolean {
    if (!dbAdapter) {
        return false;
    }
    return dbAdapter.supportsProcedures ? dbAdapter.supportsProcedures() : false;
} 