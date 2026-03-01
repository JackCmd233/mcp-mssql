import {formatErrorResponse} from '../utils/formatUtils.js';

// 导入所有工具实现
import {readQuery, writeQuery, exportQuery} from '../tools/queryTools.js';
import {createTable, alterTable, dropTable, listTables, describeTable, listViews, describeView, getViewDefinition, listProcedures, describeProcedure, getProcedureDefinition} from '../tools/schemaTools.js';
import {appendInsight, listInsights} from '../tools/insightTools.js';

/**
 * 处理列出可用工具的请求
 * @returns 可用工具列表
 */
export function handleListTools() {
    return {
        tools: [
            {
                name: "read_query",
                title: "Read Query",
                description: "Execute a SELECT query to read data from the database. " +
                    "Returns the complete result set with all matching rows and columns. " +
                    "Only SELECT statements are allowed - use write_query for data modifications. " +
                    "Supports all database types: SQLite, SQL Server, PostgreSQL, MySQL.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The SQL SELECT query to execute (e.g., 'SELECT * FROM users WHERE active = 1')"
                        },
                    },
                    required: ["query"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        rows: {
                            type: "array",
                            description: "Array of result rows from the query"
                        },
                        columns: {
                            type: "array",
                            description: "Array of column names in the result set"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "write_query",
                title: "Write Query",
                description: "Execute INSERT, UPDATE, or DELETE queries to modify database data. " +
                    "Returns the number of affected rows. " +
                    "Cannot be used for SELECT queries - use read_query instead. " +
                    "Supports all database types: SQLite, SQL Server, PostgreSQL, MySQL. " +
                    "Requires confirm=true as a safety measure to prevent accidental data modification.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The SQL INSERT/UPDATE/DELETE query to execute"
                        },
                        confirm: {
                            type: "boolean",
                            description: "Must be set to true to confirm data modification"
                        },
                    },
                    required: ["query"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        affected_rows: {
                            type: "number",
                            description: "Number of rows affected by the operation"
                        },
                        last_id: {
                            type: "number",
                            description: "ID of the last inserted row (for INSERT operations)"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true
                }
            },
            {
                name: "create_table",
                title: "Create Table",
                description: "Create a new table in the database using a CREATE TABLE statement. " +
                    "Supports all standard SQL table creation syntax including column definitions, " +
                    "constraints, indexes, and relationships. " +
                    "Works with SQLite, SQL Server, PostgreSQL, and MySQL. " +
                    "Requires confirm=true as a safety measure to prevent accidental table creation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The complete CREATE TABLE SQL statement"
                        },
                        confirm: {
                            type: "boolean",
                            description: "Must be set to true to confirm table creation"
                        },
                    },
                    required: ["query"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            description: "True if the table was created successfully"
                        },
                        message: {
                            type: "string",
                            description: "Success message with table name"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true
                }
            },
            {
                name: "alter_table",
                title: "Alter Table",
                description: "Modify an existing table's structure using ALTER TABLE statements. " +
                    "Supports adding columns, dropping columns, renaming columns, changing data types, " +
                    "and other table modifications. " +
                    "The table must exist before alterations can be made. " +
                    "Requires confirm=true as a safety measure to prevent accidental schema changes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The ALTER TABLE SQL statement to modify table structure"
                        },
                        confirm: {
                            type: "boolean",
                            description: "Must be set to true to confirm table alteration"
                        },
                    },
                    required: ["query"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            description: "True if the table was altered successfully"
                        },
                        message: {
                            type: "string",
                            description: "Success message confirming the alteration"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true
                }
            },
            {
                name: "drop_table",
                title: "Drop Table",
                description: "Permanently delete a table from the database. " +
                    "This operation cannot be undone - all data and structure will be lost. " +
                    "Requires confirm=true to execute as a safety measure. " +
                    "Validates that the table exists before attempting deletion.",
                inputSchema: {
                    type: "object",
                    properties: {
                        table_name: {
                            type: "string",
                            description: "Name of the table to delete"
                        },
                        confirm: {
                            type: "boolean",
                            description: "Must be set to true to confirm table deletion"
                        },
                    },
                    required: ["table_name", "confirm"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            description: "True if the table was dropped successfully"
                        },
                        message: {
                            type: "string",
                            description: "Success message with the dropped table name"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true
                }
            },
            {
                name: "export_query",
                title: "Export Query",
                description: "Execute a SELECT query and export the results in CSV or JSON format. " +
                    "Only SELECT queries are allowed. " +
                    "CSV format returns comma-separated values with headers. " +
                    "JSON format returns the raw result array. " +
                    "Useful for data analysis, reporting, or data transfer.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The SQL SELECT query to execute and export"
                        },
                        format: {
                            type: "string",
                            enum: ["csv", "json"],
                            description: "Output format: 'csv' for comma-separated values, 'json' for raw JSON array"
                        },
                    },
                    required: ["query", "format"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        data: {
                            type: "string",
                            description: "Exported data in the requested format"
                        },
                        format: {
                            type: "string",
                            description: "The format of the exported data"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "list_tables",
                title: "List Tables",
                description: "Retrieve a list of all table names in the current database. " +
                    "Returns only table names without structure details. " +
                    "Use describe_table to get detailed column information for a specific table. " +
                    "Set include_views=true to also include database views (SQL Server only).",
                inputSchema: {
                    type: "object",
                    properties: {
                        include_views: {
                            type: "boolean",
                            description: "Set to true to include views in the result (SQL Server only)"
                        },
                    },
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        tables: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: {type: "string", description: "Table or view name"},
                                    type: {type: "string", enum: ["table", "view"], description: "Object type"}
                                }
                            },
                            description: "Array of table/view names and types in the database"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "describe_table",
                title: "Describe Table",
                description: "Get detailed structural information about a specific table or view. " +
                    "Returns column name, data type, nullable status, default value, " +
                    "primary key status, and column comment (if supported). " +
                    "Supports both tables and views (SQL Server only for views). " +
                    "The table or view must exist in the database.",
                inputSchema: {
                    type: "object",
                    properties: {
                        table_name: {
                            type: "string",
                            description: "Name of the table or view to describe"
                        },
                    },
                    required: ["table_name"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        name: {type: "string", description: "Table or view name"},
                        type: {type: "string", enum: ["table", "view"], description: "Object type"},
                        columns: {
                            type: "array",
                            description: "Array of column definitions",
                            items: {
                                type: "object",
                                properties: {
                                    name: {type: "string", description: "Column name"},
                                    type: {type: "string", description: "Data type"},
                                    notnull: {type: "boolean", description: "Whether the column is NOT NULL"},
                                    default_value: {type: "string", description: "Default value"},
                                    primary_key: {type: "boolean", description: "Whether the column is a primary key"},
                                    comment: {type: "string", description: "Column comment"}
                                }
                            }
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "list_views",
                title: "List Views",
                description: "Retrieve a list of all view names in the current database. " +
                    "Only works with SQL Server databases. " +
                    "Returns only view names without structure details. " +
                    "Use describe_view to get detailed column information for a specific view.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        views: {
                            type: "array",
                            items: {type: "string"},
                            description: "Array of view names in the database"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "describe_view",
                title: "Describe View",
                description: "Get detailed structural information about a specific view. " +
                    "Only works with SQL Server databases. " +
                    "Returns column name, data type, nullable status, default value, " +
                    "primary key status, and column comment (if available). " +
                    "The view must exist in the database.",
                inputSchema: {
                    type: "object",
                    properties: {
                        view_name: {
                            type: "string",
                            description: "Name of the view to describe"
                        },
                    },
                    required: ["view_name"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        name: {type: "string", description: "View name"},
                        type: {type: "string", description: "Always 'view'"},
                        columns: {
                            type: "array",
                            description: "Array of column definitions",
                            items: {
                                type: "object",
                                properties: {
                                    name: {type: "string", description: "Column name"},
                                    type: {type: "string", description: "Data type"},
                                    notnull: {type: "boolean", description: "Whether the column is NOT NULL"},
                                    default_value: {type: "string", description: "Default value"},
                                    primary_key: {type: "boolean", description: "Whether the column is a primary key"},
                                    comment: {type: "string", description: "Column comment"}
                                }
                            }
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "get_view_definition",
                title: "Get View Definition",
                description: "Retrieve the SQL definition (CREATE VIEW statement) of a specific view. " +
                    "Only works with SQL Server databases. " +
                    "Returns the complete CREATE VIEW SQL statement. " +
                    "Note: Views created WITH ENCRYPTION cannot have their definition retrieved.",
                inputSchema: {
                    type: "object",
                    properties: {
                        view_name: {
                            type: "string",
                            description: "Name of the view to get definition for"
                        },
                    },
                    required: ["view_name"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        name: {type: "string", description: "View name"},
                        definition: {type: "string", description: "CREATE VIEW SQL statement"},
                        message: {type: "string", description: "Additional information if definition is unavailable"}
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "append_insight",
                title: "Append Insight",
                description: "Add a business insight to the SQLite insights memo. " +
                    "Only works with SQLite databases - creates and uses an mcp_insights table. " +
                    "Each insight is stored with a timestamp for tracking. " +
                    "Useful for maintaining notes during analysis sessions. " +
                    "Requires confirm=true as a safety measure to prevent accidental data insertion.",
                inputSchema: {
                    type: "object",
                    properties: {
                        insight: {
                            type: "string",
                            description: "The business insight text to store in the memo"
                        },
                        confirm: {
                            type: "boolean",
                            description: "Must be set to true to confirm adding the insight"
                        },
                    },
                    required: ["insight"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        success: {
                            type: "boolean",
                            description: "True if the insight was added successfully"
                        },
                        id: {
                            type: "number",
                            description: "ID of the newly created insight entry"
                        },
                        message: {
                            type: "string",
                            description: "Success message"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false
                }
            },
            {
                name: "list_insights",
                title: "List Insights",
                description: "Retrieve all stored business insights from the SQLite insights memo. " +
                    "Only works with SQLite databases. " +
                    "Returns insights in descending order by creation time (newest first). " +
                    "Returns an empty list if no insights have been stored yet.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        insights: {
                            type: "array",
                            description: "Array of insight entries",
                            items: {
                                type: "object",
                                properties: {
                                    id: {type: "number", description: "Insight ID"},
                                    insight: {type: "string", description: "Insight text"},
                                    created_at: {type: "string", description: "Creation timestamp"}
                                }
                            }
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "list_procedures",
                title: "List Procedures",
                description: "Retrieve a list of all stored procedure names in the current database. " +
                    "Only works with SQL Server databases. " +
                    "Returns only procedure names without parameter details. " +
                    "Use describe_procedure to get detailed parameter information for a specific procedure.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        procedures: {
                            type: "array",
                            items: {type: "string"},
                            description: "Array of stored procedure names in the database"
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "describe_procedure",
                title: "Describe Procedure",
                description: "Get detailed parameter information about a specific stored procedure. " +
                    "Only works with SQL Server databases. " +
                    "Returns parameter name, data type, direction (IN/OUT/INOUT), and default value. " +
                    "The procedure must exist in the database.",
                inputSchema: {
                    type: "object",
                    properties: {
                        procedure_name: {
                            type: "string",
                            description: "Name of the stored procedure to describe"
                        },
                    },
                    required: ["procedure_name"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        name: {type: "string", description: "Procedure name"},
                        type: {type: "string", description: "Always 'procedure'"},
                        parameters: {
                            type: "array",
                            description: "Array of parameter definitions",
                            items: {
                                type: "object",
                                properties: {
                                    name: {type: "string", description: "Parameter name"},
                                    type: {type: "string", description: "Data type"},
                                    direction: {type: "string", enum: ["IN", "OUT", "INOUT"], description: "Parameter direction"},
                                    default_value: {type: "string", description: "Default value"},
                                    is_output: {type: "boolean", description: "Whether this is an output parameter"}
                                }
                            }
                        }
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
            {
                name: "get_procedure_definition",
                title: "Get Procedure Definition",
                description: "Retrieve the SQL definition (CREATE PROCEDURE statement) of a specific stored procedure. " +
                    "Only works with SQL Server databases. " +
                    "Returns the complete CREATE PROCEDURE SQL statement. " +
                    "Note: Procedures created WITH ENCRYPTION cannot have their definition retrieved.",
                inputSchema: {
                    type: "object",
                    properties: {
                        procedure_name: {
                            type: "string",
                            description: "Name of the stored procedure to get definition for"
                        },
                    },
                    required: ["procedure_name"],
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        name: {type: "string", description: "Procedure name"},
                        definition: {type: "string", description: "CREATE PROCEDURE SQL statement"},
                        message: {type: "string", description: "Additional information if definition is unavailable"}
                    }
                },
                annotations: {
                    readOnlyHint: true,
                    idempotentHint: true
                }
            },
        ],
    };
}

/**
 * 处理工具调用请求
 * @param name 要调用的工具名称
 * @param args 工具参数
 * @returns 工具执行结果
 */
export async function handleToolCall(name: string, args: any) {
    try {
        switch (name) {
            case "read_query":
                return await readQuery(args.query);

            case "write_query":
                return await writeQuery(args.query, args.confirm);

            case "create_table":
                return await createTable(args.query, args.confirm);

            case "alter_table":
                return await alterTable(args.query, args.confirm);

            case "drop_table":
                return await dropTable(args.table_name, args.confirm);

            case "export_query":
                return await exportQuery(args.query, args.format);

            case "list_tables":
                return await listTables(args.include_views);

            case "describe_table":
                return await describeTable(args.table_name);

            case "list_views":
                return await listViews();

            case "describe_view":
                return await describeView(args.view_name);

            case "get_view_definition":
                return await getViewDefinition(args.view_name);

            case "list_procedures":
                return await listProcedures();

            case "describe_procedure":
                return await describeProcedure(args.procedure_name);

            case "get_procedure_definition":
                return await getProcedureDefinition(args.procedure_name);

            case "append_insight":
                return await appendInsight(args.insight, args.confirm);

            case "list_insights":
                return await listInsights();

            default:
                throw new Error(`未知的工具: ${name}`);
        }
    } catch (error: any) {
        return formatErrorResponse(error);
    }
} 