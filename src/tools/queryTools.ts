import {dbAll, dbRun, dbExec} from '../db/index.js';
import {formatErrorResponse, formatSuccessResponse, convertToCSV} from '../utils/formatUtils.js';

/**
 * 执行只读 SQL 查询
 * @param query 要执行的 SQL 查询
 * @returns 查询结果
 */
export async function readQuery(query: string) {
    try {
        if (!query.trim().toLowerCase().startsWith("select")) {
            throw new Error("read_query 只允许执行 SELECT 查询");
        }

        const result = await dbAll(query);
        return formatSuccessResponse(result);
    } catch (error: any) {
        throw new Error(`SQL 错误: ${error.message}`);
    }
}

/**
 * 执行数据修改 SQL 查询
 * @param query 要执行的 SQL 查询
 * @param confirm 安全确认标志（默认 false，防止误操作）
 * @returns 受影响行的信息
 */
export async function writeQuery(query: string, confirm: boolean = false) {
    try {
        const lowerQuery = query.trim().toLowerCase();

        if (lowerQuery.startsWith("select")) {
            throw new Error("SELECT 操作请使用 read_query");
        }

        // 支持 INSERT、UPDATE、DELETE 和 TRUNCATE 操作
        const supportedOperations = ["insert", "update", "delete", "truncate"];
        const operation = supportedOperations.find(op => lowerQuery.startsWith(op));

        if (!operation) {
            throw new Error("write_query 只允许执行 INSERT、UPDATE、DELETE 或 TRUNCATE 操作");
        }

        // 确认检查：防止误操作
        if (!confirm) {
            return formatSuccessResponse({
                success: false,
                message: `需要安全确认。设置 confirm=true 以继续执行 ${operation.toUpperCase()} 操作。`
            });
        }

        const result = await dbRun(query);
        return formatSuccessResponse({affected_rows: result.changes});
    } catch (error: any) {
        throw new Error(`SQL 错误: ${error.message}`);
    }
}

/**
 * 将查询结果导出为 CSV 或 JSON 格式
 * @param query 要执行的 SQL 查询
 * @param format 输出格式(csv 或 json)
 * @returns 格式化的查询结果
 */
export async function exportQuery(query: string, format: string) {
    try {
        if (!query.trim().toLowerCase().startsWith("select")) {
            throw new Error("export_query 只允许执行 SELECT 查询");
        }

        const result = await dbAll(query);

        if (format === "csv") {
            const csvData = convertToCSV(result);
            return {
                content: [{
                    type: "text",
                    text: csvData
                }],
                isError: false,
            };
        } else if (format === "json") {
            return formatSuccessResponse(result);
        } else {
            throw new Error("不支持的导出格式。请使用 'csv' 或 'json'");
        }
    } catch (error: any) {
        throw new Error(`导出错误: ${error.message}`);
    }
} 