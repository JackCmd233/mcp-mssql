import {dbAll, getListTablesQuery, getDescribeTableQuery, getDatabaseMetadata} from '../db/index.js';

/**
 * 处理列出资源的请求
 * @returns 可用资源列表
 */
export async function handleListResources() {
    try {
        const dbInfo = getDatabaseMetadata();
        const dbType = dbInfo.type;
        let resourceBaseUrl: URL;

        // 根据数据库类型创建适当的 URL
        if (dbType === 'sqlite' && dbInfo.path) {
            resourceBaseUrl = new URL(`sqlite:///${dbInfo.path}`);
        } else if (dbType === 'sqlserver' && dbInfo.server && dbInfo.database) {
            resourceBaseUrl = new URL(`sqlserver://${dbInfo.server}/${dbInfo.database}`);
        } else {
            resourceBaseUrl = new URL(`db:///database`);
        }

        const SCHEMA_PATH = "schema";

        // 使用适配器特定的查询来列出表
        const query = getListTablesQuery();
        const result = await dbAll(query);

        return {
            resources: result.map((row: any) => ({
                uri: new URL(`${row.name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
                mimeType: "application/json",
                name: `"${row.name}" database schema`,
            })),
        };
    } catch (error: any) {
        throw new Error(`列出资源失败: ${error.message}`);
    }
}

/**
 * 处理读取特定资源的请求
 * @param uri 要读取的资源 URI
 * @returns 资源内容
 */
export async function handleReadResource(uri: string) {
    try {
        const resourceUrl = new URL(uri);
        const SCHEMA_PATH = "schema";

        const pathComponents = resourceUrl.pathname.split("/");
        const schema = pathComponents.pop();
        const tableName = pathComponents.pop();

        if (schema !== SCHEMA_PATH) {
            throw new Error("无效的资源 URI");
        }

        // 使用适配器特定的查询来描述表结构
        const query = getDescribeTableQuery(tableName!);
        const result = await dbAll(query);

        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(result.map((column: any) => ({
                        column_name: column.name,
                        data_type: column.type,
                        comment: column.comment || null
                    })), null, 2),
                },
            ],
        };
    } catch (error: any) {
        throw new Error(`读取资源失败: ${error.message}`);
    }
} 