/**
 * 将数据转换为 CSV 格式
 * @param data 要转换为 CSV 的对象数组
 * @returns CSV 格式的字符串
 */
export function convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    // 获取表头
    const headers = Object.keys(data[0]);

    // 创建 CSV 表头行
    let csv = headers.join(',') + '\n';

    // 添加数据行
    data.forEach(row => {
        const values = headers.map(header => {
            const val = row[header];
            // 处理包含逗号、引号等的字符串
            if (typeof val === 'string') {
                return `"${val.replace(/"/g, '""')}"`;
            }
            // 对于 null/undefined 使用空字符串
            return val === null || val === undefined ? '' : val;
        });
        csv += values.join(',') + '\n';
    });

    return csv;
}

/**
 * 格式化错误响应
 * @param error 错误对象或错误消息
 * @returns 格式化的错误响应对象
 */
export function formatErrorResponse(error: Error | string): {
    content: Array<{ type: string, text: string }>,
    isError: boolean
} {
    const message = error instanceof Error ? error.message : error;
    return {
        content: [{
            type: "text",
            text: JSON.stringify({error: message}, null, 2)
        }],
        isError: true
    };
}

/**
 * 格式化成功响应
 * @param data 要格式化的数据
 * @returns 格式化的成功响应对象
 */
export function formatSuccessResponse(data: any): { content: Array<{ type: string, text: string }>, isError: boolean } {
    return {
        content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
        }],
        isError: false
    };
} 