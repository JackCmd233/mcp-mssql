/**
 * SQL 操作验证工具
 * 集中管理禁用的 SQL 操作，确保数据库安全
 */

/**
 * 禁用操作的配置定义
 */
interface ForbiddenOperationConfig {
    type: 'DROP' | 'TRUNCATE';
    pattern: RegExp;
    message: string;
}

/**
 * 禁用的 SQL 操作类型及其错误消息
 * 使用更严格的模式，检测注释后的危险语句
 */
const FORBIDDEN_OPERATIONS: ForbiddenOperationConfig[] = [
    {
        type: 'DROP',
        // 匹配 DROP，忽略前导空白和单行注释
        pattern: /^(\s*|--[^\n]*\n)*DROP\s/i,
        message: 'DROP 操作已被禁用，此类操作应由 DBA 在数据库层面处理'
    },
    {
        type: 'TRUNCATE',
        // 匹配 TRUNCATE，忽略前导空白和单行注释
        pattern: /^(\s*|--[^\n]*\n)*TRUNCATE\s/i,
        message: 'TRUNCATE 操作已被禁用，因为它不可回滚且不触发触发器'
    }
];

/**
 * 验证 SQL 查询是否包含禁用的操作
 * @param query 要验证的 SQL 查询
 * @throws Error 如果查询包含禁用的操作
 */
export function validateForbiddenOperations(query: string): void {
    for (const { pattern, message } of FORBIDDEN_OPERATIONS) {
        if (pattern.test(query)) {
            throw new Error(message);
        }
    }
}
