/**
 * 数据库适配器接口
 * 定义所有数据库实现的契约(SQLite、SQL Server)
 */
export interface DbAdapter {
    /**
     * 初始化数据库连接
     */
    init(): Promise<void>;

    /**
     * 关闭数据库连接
     */
    close(): Promise<void>;

    /**
     * 执行查询并返回所有结果
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     */
    all(query: string, params?: any[]): Promise<any[]>;

    /**
     * 执行修改数据的查询
     * @param query 要执行的 SQL 查询
     * @param params 查询参数
     */
    run(query: string, params?: any[]): Promise<{ changes: number, lastID: number }>;

    /**
     * 执行多条 SQL 语句
     * @param query 要执行的 SQL 语句
     */
    exec(query: string): Promise<void>;

    /**
     * 获取数据库元数据
     */
    getMetadata(): { name: string, type: string, path?: string, server?: string, database?: string };

    /**
     * 获取列出表的数据库特定查询
     */
    getListTablesQuery(): string;

    /**
     * 获取描述表的数据库特定查询
     * @param tableName 表名
     */
    getDescribeTableQuery(tableName: string): string;

    /**
     * 获取列出视图的数据库特定查询（可选）
     * 仅 SQL Server 支持
     */
    getListViewsQuery?(): string;

    /**
     * 获取视图定义的数据库特定查询（可选）
     * 仅 SQL Server 支持
     * @param viewName 视图名
     */
    getViewDefinitionQuery?(viewName: string): string;

    /**
     * 检查数据库是否支持视图功能（可选）
     * 默认返回 false
     */
    supportsViews?(): boolean;

    /**
     * 获取列出存储过程的数据库特定查询（可选）
     * 仅 SQL Server 支持
     */
    getListProceduresQuery?(): string;

    /**
     * 获取存储过程参数信息的查询（可选）
     * 仅 SQL Server 支持
     * @param procedureName 存储过程名
     */
    getDescribeProcedureQuery?(procedureName: string): string;

    /**
     * 获取存储过程定义的查询（可选）
     * 仅 SQL Server 支持
     * @param procedureName 存储过程名
     */
    getProcedureDefinitionQuery?(procedureName: string): string;

    /**
     * 检查数据库是否支持存储过程功能（可选）
     * 默认返回 false
     */
    supportsProcedures?(): boolean;
}

// 使用动态导入适配器
import {SqliteAdapter} from './sqlite-adapter.js';
import {SqlServerAdapter} from './sqlserver-adapter.js';
import {PostgresqlAdapter} from './postgresql-adapter.js';
import {MysqlAdapter} from './mysql-adapter.js';

/**
 * 工厂函数,创建相应的数据库适配器
 */
export function createDbAdapter(type: string, connectionInfo: any): DbAdapter {
    switch (type.toLowerCase()) {
        case 'sqlite':
            // 对于 SQLite,如果 connectionInfo 是字符串,则直接将其用作路径
            if (typeof connectionInfo === 'string') {
                return new SqliteAdapter(connectionInfo);
            } else {
                return new SqliteAdapter(connectionInfo.path);
            }
        case 'sqlserver':
            return new SqlServerAdapter(connectionInfo);
        case 'postgresql':
        case 'postgres':
            return new PostgresqlAdapter(connectionInfo);
        case 'mysql':
            return new MysqlAdapter(connectionInfo);
        default:
            throw new Error(`不支持的数据库类型: ${type}`);
    }
} 