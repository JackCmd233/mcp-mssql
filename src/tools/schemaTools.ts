import {dbAll, dbExec, getListTablesQuery, getDescribeTableQuery, getListViewsQuery, getViewDefinitionQuery, supportsViews, getListProceduresQuery, getDescribeProcedureQuery, getProcedureDefinitionQuery, supportsProcedures} from '../db/index.js';
import {formatSuccessResponse} from '../utils/formatUtils.js';

/**
 * 格式化后的列结构类型
 */
interface FormattedColumn {
    name: string;
    type: string;
    notnull: boolean;
    default_value: any;
    primary_key: boolean;
    comment: string | null;
}

/**
 * 检查数据库对象是否存在
 * @param objectName 对象名
 * @param objectType 对象类型 ('table' | 'view')
 * @returns 如果存在返回 true，否则返回 false
 */
async function checkObjectExists(objectName: string, objectType: 'table' | 'view'): Promise<boolean> {
    if (objectType === 'table') {
        const query = getListTablesQuery();
        const objects = await dbAll(query);
        return objects.some(obj => obj.name === objectName);
    } else if (supportsViews()) {
        const query = getListViewsQuery();
        const objects = await dbAll(query);
        return objects.some(obj => obj.name === objectName);
    }
    return false;
}

/**
 * 检查存储过程是否存在
 * @param procedureName 存储过程名
 * @returns 如果存在返回 true，否则返回 false
 */
async function checkProcedureExists(procedureName: string): Promise<boolean> {
    if (!supportsProcedures()) {
        return false;
    }
    const query = getListProceduresQuery();
    const procedures = await dbAll(query);
    return procedures.some(proc => proc.name === procedureName);
}

/**
 * 格式化列结构信息
 * @param columns 原始列数据数组
 * @returns 格式化后的列数组
 */
function formatColumns(columns: any[]): FormattedColumn[] {
    return columns.map((col) => ({
        name: col.name,
        type: col.type,
        notnull: !!col.notnull,
        default_value: col.dflt_value,
        primary_key: !!col.pk,
        comment: col.comment || null
    }));
}

/**
 * 从 SQL 语句中提取表名
 * @param query SQL 语句
 * @param operation SQL 操作类型（CREATE TABLE、ALTER TABLE 等）
 * @returns 提取的表名或 null
 */
function extractTableName(query: string, operation: string): string | null {
    try {
        const normalizedQuery = query.trim().replace(/\s+/g, ' ');
        const operationPrefix = operation.toLowerCase();

        if (!normalizedQuery.toLowerCase().startsWith(operationPrefix)) {
            return null;
        }

        // 移除操作前缀后的剩余部分
        const afterOperation = normalizedQuery.substring(operationPrefix.length).trim();

        // 处理 IF NOT EXISTS 或 IF EXISTS 等子句
        const patterns = [
            /^if\s+not\s+exists\s+([^\s(]+)/i,  // CREATE TABLE IF NOT EXISTS tablename
            /^if\s+exists\s+([^\s(]+)/i,        // DROP TABLE IF EXISTS tablename
            /^([^\s(]+)/                        // CREATE TABLE tablename
        ];

        for (const pattern of patterns) {
            const match = afterOperation.match(pattern);
            if (match && match[1]) {
                // 移除引号（如果有）
                return match[1].replace(/^[`"[]|[`"\]]$/g, '');
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 在数据库中创建新表
 * @param query CREATE TABLE SQL 语句
 * @param confirm 安全确认标志（默认 false，防止误操作）
 * @returns 操作结果
 */
export async function createTable(query: string, confirm: boolean = false) {
    try {
        if (!query.trim().toLowerCase().startsWith("create table")) {
            throw new Error("只允许执行 CREATE TABLE 语句");
        }

        // 确认检查：防止误操作
        if (!confirm) {
            const tableName = extractTableName(query, "CREATE TABLE");
            const tableInfo = tableName ? ` '${tableName}'` : '';
            return formatSuccessResponse({
                success: false,
                message: `需要安全确认。设置 confirm=true 以继续创建表${tableInfo}。`
            });
        }

        await dbExec(query);
        return formatSuccessResponse({success: true, message: "表创建成功"});
    } catch (error: any) {
        throw new Error(`SQL 错误: ${error.message}`);
    }
}

/**
 * 修改现有表的结构
 * @param query ALTER TABLE SQL 语句
 * @param confirm 安全确认标志（默认 false，防止误操作）
 * @returns 操作结果
 */
export async function alterTable(query: string, confirm: boolean = false) {
    try {
        if (!query.trim().toLowerCase().startsWith("alter table")) {
            throw new Error("只允许执行 ALTER TABLE 语句");
        }

        // 确认检查：防止误操作
        if (!confirm) {
            const tableName = extractTableName(query, "ALTER TABLE");
            const tableInfo = tableName ? ` '${tableName}'` : '';
            return formatSuccessResponse({
                success: false,
                message: `需要安全确认。设置 confirm=true 以继续修改表结构${tableInfo}。`
            });
        }

        await dbExec(query);
        return formatSuccessResponse({success: true, message: "表结构修改成功"});
    } catch (error: any) {
        throw new Error(`SQL 错误: ${error.message}`);
    }
}

/**
 * 从数据库中删除表
 * @param tableName 要删除的表名
 * @param confirm 安全确认标志
 * @returns 操作结果
 * @deprecated DROP 操作已被禁用，此类操作应由 DBA 在数据库层面处理
 */
export async function dropTable(tableName: string, confirm: boolean) {
    // DROP 操作已被禁用
    return formatSuccessResponse({
        success: false,
        message: "DROP 操作已被禁用，此类操作应由 DBA 在数据库层面处理。如需删除表，请联系数据库管理员。"
    });
}

/**
 * 列出数据库中的所有表
 * @param includeViews 是否包含视图（默认 false）
 * @returns 表名数组
 */
export async function listTables(includeViews: boolean = false) {
    try {
        // 使用适配器特定的查询来列出表
        const query = getListTablesQuery();
        const tables = await dbAll(query);
        const result = tables.map((t) => ({name: t.name, type: 'table'}));

        // 如果需要包含视图且数据库支持视图
        if (includeViews && supportsViews()) {
            const viewsQuery = getListViewsQuery();
            const views = await dbAll(viewsQuery);
            result.push(...views.map((v) => ({name: v.name, type: 'view'} as const)));
        }

        return formatSuccessResponse(result);
    } catch (error: any) {
        throw new Error(`列出表失败: ${error.message}`);
    }
}

/**
 * 获取指定表的结构信息
 * 支持实体表和视图
 * @param tableName 要描述的表名或视图名
 * @returns 表/视图的列定义
 */
export async function describeTable(tableName: string) {
    try {
        if (!tableName) {
            throw new Error("表名不能为空");
        }

        // 检查是表还是视图
        let objectType: 'table' | 'view' = 'table';

        if (await checkObjectExists(tableName, 'table')) {
            objectType = 'table';
        } else if (supportsViews() && await checkObjectExists(tableName, 'view')) {
            objectType = 'view';
        } else {
            // 错误消息不直接包含用户输入，防止日志注入
            throw new Error(supportsViews() ? "指定的表或视图不存在" : "指定的表不存在");
        }

        // 使用适配器特定的查询来描述表/视图结构
        const descQuery = getDescribeTableQuery(tableName);
        const columns = await dbAll(descQuery);

        return formatSuccessResponse({
            name: tableName,
            type: objectType,
            columns: formatColumns(columns)
        });
    } catch (error: any) {
        throw new Error(`描述表结构失败: ${error.message}`);
    }
}

/**
 * 列出数据库中的所有视图
 * 仅支持 SQL Server
 * @returns 视图名数组
 */
export async function listViews() {
    try {
        if (!supportsViews()) {
            throw new Error("视图功能仅支持 SQL Server 数据库");
        }

        const query = getListViewsQuery();
        const views = await dbAll(query);
        return formatSuccessResponse(views.map((v) => v.name));
    } catch (error: any) {
        throw new Error(`列出视图失败: ${error.message}`);
    }
}

/**
 * 获取指定视图的结构信息
 * 仅支持 SQL Server
 * @param viewName 视图名
 * @returns 视图的列定义
 */
export async function describeView(viewName: string) {
    try {
        if (!viewName) {
            throw new Error("视图名不能为空");
        }

        if (!supportsViews()) {
            throw new Error("视图功能仅支持 SQL Server 数据库");
        }

        // 检查视图是否存在
        if (!(await checkObjectExists(viewName, 'view'))) {
            // 错误消息不直接包含用户输入，防止日志注入
            throw new Error("指定的视图不存在");
        }

        // 使用相同的 describe 查询获取视图列结构
        const descQuery = getDescribeTableQuery(viewName);
        const columns = await dbAll(descQuery);

        return formatSuccessResponse({
            name: viewName,
            type: 'view',
            columns: formatColumns(columns)
        });
    } catch (error: any) {
        throw new Error(`描述视图结构失败: ${error.message}`);
    }
}

/**
 * 获取视图的定义 SQL
 * 仅支持 SQL Server
 * 注意: 使用 WITH ENCRYPTION 创建的视图无法获取定义
 * @param viewName 视图名
 * @returns 视图定义 SQL
 */
export async function getViewDefinition(viewName: string) {
    try {
        if (!viewName) {
            throw new Error("视图名不能为空");
        }

        if (!supportsViews()) {
            throw new Error("视图功能仅支持 SQL Server 数据库");
        }

        // 检查视图是否存在
        if (!(await checkObjectExists(viewName, 'view'))) {
            // 错误消息不直接包含用户输入，防止日志注入
            throw new Error("指定的视图不存在");
        }

        // 获取视图定义
        const defQuery = getViewDefinitionQuery(viewName);
        const result = await dbAll(defQuery);

        if (result.length === 0 || !result[0].definition) {
            return formatSuccessResponse({
                name: viewName,
                definition: null,
                message: "视图定义不可用（可能使用 WITH ENCRYPTION 创建）"
            });
        }

        return formatSuccessResponse({
            name: viewName,
            definition: result[0].definition
        });
    } catch (error: any) {
        throw new Error(`获取视图定义失败: ${error.message}`);
    }
}

/**
 * 列出数据库中的所有存储过程
 * 仅支持 SQL Server
 * @returns 存储过程名数组
 */
export async function listProcedures() {
    try {
        if (!supportsProcedures()) {
            throw new Error("存储过程功能仅支持 SQL Server 数据库");
        }

        const query = getListProceduresQuery();
        const procedures = await dbAll(query);
        return formatSuccessResponse(procedures.map((p) => p.name));
    } catch (error: any) {
        throw new Error(`列出存储过程失败: ${error.message}`);
    }
}

/**
 * 验证存储过程名称格式是否合法
 * @param name 存储过程名称
 * @throws 如果名称包含非法字符
 */
function validateProcedureNameFormat(name: string): void {
    // 检查名称是否为空
    if (!name || typeof name !== 'string') {
        throw new Error("存储过程名不能为空");
    }

    // 检查名称长度（SQL Server 限制为 128 字符）
    if (name.length > 128) {
        throw new Error("存储过程名称长度超过限制（最大 128 字符）");
    }

    // 检查是否包含危险的 SQL 字符
    // 只允许字母、数字、下划线和常见的安全字符
    const validNamePattern = /^[a-zA-Z_][a-zA-Z0-9_@$#]*$/;
    if (!validNamePattern.test(name)) {
        throw new Error("存储过程名称包含非法字符");
    }
}

/**
 * 验证存储过程操作的前置条件
 * @param procedureName 存储过程名
 */
async function validateProcedureOperation(procedureName: string): Promise<void> {
    // 首先验证名称格式，防止恶意输入
    validateProcedureNameFormat(procedureName);

    if (!supportsProcedures()) {
        throw new Error("存储过程功能仅支持 SQL Server 数据库");
    }
    if (!(await checkProcedureExists(procedureName))) {
        // 错误消息不直接包含用户输入，防止日志注入
        throw new Error("指定的存储过程不存在");
    }
}

/**
 * 获取存储过程的参数信息
 * 仅支持 SQL Server
 * @param procedureName 存储过程名
 * @returns 存储过程的参数定义
 */
export async function describeProcedure(procedureName: string) {
    try {
        await validateProcedureOperation(procedureName);

        // 获取参数信息
        const descQuery = getDescribeProcedureQuery(procedureName);
        const params = await dbAll(descQuery);

        // 格式化参数信息
        const parameters = params.map((param) => ({
            name: param.name,
            type: param.type,
            direction: param.direction,
            default_value: param.default_value,
            is_output: !!param.is_output
        }));

        return formatSuccessResponse({
            name: procedureName,
            type: 'procedure',
            parameters: parameters
        });
    } catch (error: any) {
        throw new Error(`描述存储过程失败: ${error.message}`);
    }
}

/**
 * 获取存储过程的定义 SQL
 * 仅支持 SQL Server
 * 注意: 使用 WITH ENCRYPTION 创建的存储过程无法获取定义
 * @param procedureName 存储过程名
 * @returns 存储过程定义 SQL
 */
export async function getProcedureDefinition(procedureName: string) {
    try {
        await validateProcedureOperation(procedureName);

        // 获取存储过程定义
        const defQuery = getProcedureDefinitionQuery(procedureName);
        const result = await dbAll(defQuery);

        if (result.length === 0 || !result[0].definition) {
            return formatSuccessResponse({
                name: procedureName,
                definition: null,
                message: "存储过程定义不可用（可能使用 WITH ENCRYPTION 创建）"
            });
        }

        return formatSuccessResponse({
            name: procedureName,
            definition: result[0].definition
        });
    } catch (error: any) {
        throw new Error(`获取存储过程定义失败: ${error.message}`);
    }
} 