import {dbAll, dbExec, dbRun} from '../db/index.js';
import {formatSuccessResponse} from '../utils/formatUtils.js';

/**
 * 添加业务洞察到备忘录
 * @param insight 业务洞察文本
 * @param confirm 安全确认标志（默认 false，防止误操作）
 * @returns 操作结果，包含新增记录的 ID
 */
export async function appendInsight(insight: string, confirm: boolean = false) {
    try {
        if (!insight) {
            throw new Error("洞察内容不能为空");
        }

        // 确认检查：防止误操作
        if (!confirm) {
            return formatSuccessResponse({
                success: false,
                message: "需要安全确认。设置 confirm=true 以继续添加洞察。"
            });
        }

        // 如果 insights 表不存在则创建
        await dbExec(`
      CREATE TABLE IF NOT EXISTS mcp_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        insight TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // 插入洞察记录并获取返回的 ID
        const result = await dbRun(
            "INSERT INTO mcp_insights (insight) VALUES (?)",
            [insight]
        );

        return formatSuccessResponse({
            success: true,
            message: "洞察已添加",
            id: result.lastID
        });
    } catch (error: any) {
        throw new Error(`添加洞察失败: ${error.message}`);
    }
}

/**
 * 列出备忘录中的所有洞察
 * @returns 洞察数组
 */
export async function listInsights() {
    try {
        // 检查 insights 表是否存在
        const tableExists = await dbAll(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = 'mcp_insights'"
        );

        if (tableExists.length === 0) {
            // 如果表不存在则创建
            await dbExec(`
        CREATE TABLE IF NOT EXISTS mcp_insights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          insight TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
            return formatSuccessResponse([]);
        }

        const insights = await dbAll("SELECT * FROM mcp_insights ORDER BY created_at DESC");
        return formatSuccessResponse(insights);
    } catch (error: any) {
        throw new Error(`列出洞察失败: ${error.message}`);
    }
} 