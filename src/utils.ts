import { AST, BaseFrom, Column, ColumnRef, Expr, From, Function, Join, Parser } from 'node-sql-parser';

const cyrb53 = (str: string, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    
    return 4294967296 * (2097151 & h2) + (h1 >>> 0) // % 2**16;
};

class HashedRow {
    private values: (number | string | Uint8Array | null)[] = [];
    private hash: bigint;

    constructor(data: (number | string | Uint8Array | null)[]) {
        this.values = data;

        this.hash = BigInt(17);
        for (let i = 0; i < data.length; i++) {
            if (typeof data[i] === 'string') {
                this.hash += BigInt(cyrb53(data[i] as string));
            } else if (typeof data[i] === 'number') {
                this.hash +=  BigInt(data[i] as number);
            } else if (data[i] === null) {
                this.hash += BigInt(17);
            } else {
                for (let j = 0; j < (data[i] as Uint8Array).length; j++) {
                    this.hash += BigInt((data[i] as Uint8Array)[j]);
                }
            }
        }
    }

    equals(other: HashedRow) {
        if (this.values.length !== other.values.length) {
            return false;
        }

        if (this.hash !== other.hash) {
            return false;
        }

        // Try match all values in this set to the other set
        return this.backtrackCompare(0, new Array<boolean>(other.values.length).fill(false), other.values);
    }

    private backtrackCompare(index: number, used: boolean[], otherValues: (number | string | Uint8Array | null)[]): boolean {
        if (index === this.values.length) {
            return true;
        }

        for (let i = 0; i < otherValues.length; i++) {
            if (!used[i] && this.valueEquals(this.values[index], otherValues[i])) {
                used[i] = true;
                if (this.backtrackCompare(index + 1, used, otherValues)) {
                    return true;
                }
                used[i] = false;
            }
        }

        return false;
    }

    private valueEquals(value1: number | string | Uint8Array | null, value2: number | string | Uint8Array | null): boolean {
        if (value1 === value2) {
            return true;
        }

        if (value1 instanceof Uint8Array && value2 instanceof Uint8Array) {
            if (value1.length !== value2.length) {
                return false;
            }
            for (let i = 0; i < value1.length; i++) {
                if (value1[i] !== value2[i]) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    getHash() {
        return this.hash;
    }
}

class RowHashSet {
    // array of arrays of hashed rows
    private buckets: HashedRow[][] = [];

    constructor(size: number = 100) {
        this.buckets = new Array(size).fill([]).map(() => []);
    }

    add(row: HashedRow) {
        const bucket = this.getBucket(row);
        bucket.push(row);
    }

    remove(row: HashedRow) {
        const bucket = this.getBucket(row);
        const index = bucket.findIndex(r => r.equals(row));
        if (index !== -1) {
            bucket.splice(index, 1);
            return true;
        }
        return false;
    }

    contains(row: HashedRow) {
        const bucket = this.getBucket(row);
        return bucket.some(r => r.equals(row));
    }

    private getBucket(row: HashedRow): HashedRow[] {
        let hash = row.getHash();
        if (hash < 0) {
            hash = -hash;
        }
        return this.buckets[Number(hash % BigInt(this.buckets.length))];
    }

    isEmpty() {
        return this.buckets.every(bucket => bucket.length === 0);
    }
}

interface Result {
    columns: string[];
    data: (number | string | Uint8Array | null)[][];
}
    

export function isCorrectResult(expected: Result, actual: Result) {
    // Check if the columns are the same
    if (expected.columns.length !== actual.columns.length) {
        return false;
    }

    // Convert rows to hashed rows
    const expectedRows = expected.data.map(row => new HashedRow(row));
    const actualRows = actual.data.map(row => new HashedRow(row));

    // put actualRows in hashset for fast removal
    const actualRowsSet = new RowHashSet(actualRows.length);

    for (const row of actualRows) {
        actualRowsSet.add(row);
    }

    for (const row of expectedRows) {
        if (!actualRowsSet.remove(row)) {
            return false;
        }
    }

    return actualRowsSet.isEmpty();
}

export interface JoinCondition {
    table1: string;
    column1: string;
    table2: string;
    column2: string;
}

interface ColumnConstraint {
    table: string | null;
    column: string;
}

export interface TableColumns {
    table: string;
    columns: string[];
}

export enum IssueSeverity {
    WARNING = 'WARNING',
    ERROR = 'ERROR'
}

export abstract class Issue {
    constructor(public type: string, private severity: IssueSeverity = IssueSeverity.WARNING) {}

    abstract toString(): string;

    getSeverity() {
        return this.severity;
    }
}

export class AnalyzerIssue extends Issue {
    constructor(public message: string) {
        super('ANALYZER_ISSUE', IssueSeverity.ERROR);
    }

    toString() {
        return this.message;
    }
}

class IncompleteJoinIssue extends Issue {
    constructor(public table1: string, public table2: string) {
        super('INCOMPLETE_JOIN', IssueSeverity.WARNING);
    }

    toString() {
        return `Tables ${this.table1} and ${this.table2} not joined per the FK-PK relationship`; 
    }
}

class DanglingTableGroupIssue extends Issue {
    constructor(public tables: string[]) {
        super('DANGLING_TABLE_GROUP', IssueSeverity.ERROR);
    }

    toString() {
        return `Tables ${this.tables.join(', ')} are not joined to the other table(s)`;
    }
}

class IncompleteGroupByIssue extends Issue {
    constructor(public columns: string[]) {
        super('INCOMPLETE_GROUP_BY', IssueSeverity.WARNING);
    }

    toString() {
        return `Columns ${this.columns.join(', ')} are not in the GROUP BY clause`;
    }
}

// This is specific to the SQL dialect used in the course
class ForbiddenInnerJoinSyntaxIssue extends Issue {
    constructor() {
        super('FORBIDDEN_INNER_JOIN_SYNTAX', IssueSeverity.ERROR);
    }

    toString() {
        return 'Forbidden INNER JOIN syntax used';
    }
}

type ASTFunction<T extends any[]> = (node: AST, ...args: T) => void;

export class SQLAnalyzer {
    private parser: Parser = new Parser();

    constructor(private joinRules: JoinCondition[], private columnsPerTable: TableColumns[]) {}

    private extractTableAliasMapping(fromClause: From[]) {
        const mapping: { [key: string]: string } = {};
        fromClause.forEach((tableRef) => {
            if ("type" in tableRef || "expr" in tableRef) {
                return;
            }
            if (tableRef.as) {
                mapping[tableRef.as] = tableRef.table;
            } else {
                mapping[tableRef.table] = tableRef.table;
            }
        });

        return mapping;
    }

    private traverseAst<T extends any[]>(node: AST, fun: ASTFunction<T>, ...args: T): void {
        const supportedTypes = ['select'];
        for (const key in node) {
            // @ts-ignore
            const child = node[key];
            if (typeof child === 'object' && child !== null && 'type' in child && supportedTypes.includes(child.type)) {
                fun(child, ...args);
            }
        }
    }

    private extractJoinConditions(whereClause: Expr | Function, tableAliasMapping: Record<string, string>): ColumnConstraint[][] {
        const conditions: ColumnConstraint[][] = [];

        if (whereClause.type === 'binary_expr' && whereClause.operator === '=') {
            // both left and right must have type column_ref
            if (whereClause.left.type === 'column_ref' && whereClause.right.type === 'column_ref') {
                const leftTable = (whereClause.left as ColumnRef).table ? tableAliasMapping[(whereClause.left as ColumnRef).table!] || (whereClause.left as ColumnRef).table : null;
                const rightTable = (whereClause.right as ColumnRef).table ? tableAliasMapping[(whereClause.right as ColumnRef).table!] || (whereClause.right as ColumnRef).table : null;
                conditions.push([
                    {
                        table: leftTable,
                        column: (whereClause.left as ColumnRef).column as string
                    },
                    {
                        table: rightTable,
                        column: (whereClause.right as ColumnRef).column as string
                    }
                ]);
            }
        } else if (whereClause.type === 'binary_expr' && whereClause.operator === 'AND') {
            conditions.push(...this.extractJoinConditions(whereClause.left as Expr | Function, tableAliasMapping));
            conditions.push(...this.extractJoinConditions(whereClause.right as Expr | Function, tableAliasMapping));
        }

        return conditions;
    }

    private getRequiredJoins(fromClause: From[], tableAliasMapping: Record<string, string>): JoinCondition[][] {
        const tables = fromClause.filter(table => !("join" in table) && !("expr" in table)).map(table => {
            const tableFrom = table as BaseFrom;
            if (tableFrom.as) {
                return tableFrom.as;
            } else {
                return tableFrom.table;
            }
        }).map(table => table.toLowerCase());
        const requiredJoins: JoinCondition[][] = [];

        this.joinRules.forEach(rule => {
            if (tables.includes(rule.table1) && tables.includes(rule.table2)) {
                requiredJoins.push([
                    { table1: rule.table1, column1: rule.column1, table2: rule.table2, column2: rule.column2 }
                ]);
            }
        });

        return requiredJoins;
    }

    private findIncompleteJoins(node: AST, tableAliasMapping: Record<string, string>, issues: IncompleteJoinIssue[]): IncompleteJoinIssue[] {
        let nextAliasMapping = { ...tableAliasMapping };
        if (node.type === 'select') {
            const fromClause = node.from;
            const whereClause = node.where;

            if (fromClause && fromClause.length > 1) {
                const localTableAliasMapping = this.extractTableAliasMapping(fromClause);
                const combinedTableAliasMapping = { ...tableAliasMapping, ...localTableAliasMapping };
                nextAliasMapping = { ...combinedTableAliasMapping}
                const tables = Object.values(combinedTableAliasMapping);
                let joinConditions = whereClause ? this.extractJoinConditions(whereClause, combinedTableAliasMapping) : [];

                // Handling explicit JOIN ... ON conditions
                fromClause.forEach(part => {
                    if (!("join" in part)) {
                        return;
                    }
                    const join = part as Join;
                    if (join.join && join.on) {
                        const onConditions = this.extractJoinConditions(join.on, combinedTableAliasMapping);
                        joinConditions = joinConditions.concat(onConditions);
                    }
                });

                const requiredJoins = this.getRequiredJoins(fromClause, combinedTableAliasMapping);
                // Some join conditions may have table undefined as it is implied
                // so we define them explicitly by checking the available tables and finding the suitable table
                // for the undefined table
                joinConditions.forEach(condition => {
                    if (!condition[0].table) {
                        const table = tables.find(t => this.columnsPerTable.find(cpt => cpt.table === t && cpt.columns.includes(condition[0].column)));
                        if (table) {
                            condition[0].table = table;
                        }
                    }
                    if (!condition[1].table) {
                        const table = tables.find(t => this.columnsPerTable.find(cpt => cpt.table === t && cpt.columns.includes(condition[1].column)));
                        if (table) {
                            condition[1].table = table;
                        }
                    }
                });
                requiredJoins.forEach(requiredJoin => {
                    const isCompleteJoin = joinConditions.some(joinCondition => {
                        return (joinCondition[0].table === requiredJoin[0].table1 &&
                                joinCondition[0].column === requiredJoin[0].column1 &&
                                joinCondition[1].table === requiredJoin[0].table2 &&
                                joinCondition[1].column === requiredJoin[0].column2) ||
                               (joinCondition[0].table === requiredJoin[0].table2 &&
                                joinCondition[0].column === requiredJoin[0].column2 &&
                                joinCondition[1].table === requiredJoin[0].table1 &&
                                joinCondition[1].column === requiredJoin[0].column1);
                               });
                    if (!isCompleteJoin) {
                        if (issues.every(issue => issue.table1 !== requiredJoin[0].table1 && issue.table2 !== requiredJoin[0].table2)) {
                            issues.push(new IncompleteJoinIssue(requiredJoin[0].table1, requiredJoin[0].table2));
                        }
                    }
                });
            }
        }
        this.traverseAst(node, this.findIncompleteJoins, nextAliasMapping, issues);

        return issues;
    }

    private findDanglingTableGroups(node: AST, tableAliasMapping: Record<string, string>, issues: DanglingTableGroupIssue[]): DanglingTableGroupIssue[] {
        let nextAliasMapping = { ...tableAliasMapping };
        if (node.type === 'select') {
            const fromClause = node.from;
            const whereClause = node.where;

            if (fromClause && fromClause.length > 1) {
                const localTableAliasMapping = this.extractTableAliasMapping(fromClause);
                const combinedTableAliasMapping = { ...tableAliasMapping, ...localTableAliasMapping };
                nextAliasMapping = { ...combinedTableAliasMapping}
                const tables = Object.values(combinedTableAliasMapping);
                let joinConditions = whereClause ? this.extractJoinConditions(whereClause, combinedTableAliasMapping) : [];

                // Handling explicit JOIN ... ON conditions
                fromClause.forEach(part => {
                    if (!("join" in part)) {
                        return;
                    }
                    const join = part as Join;
                    if (join.join && join.on) {
                        const onConditions = this.extractJoinConditions(join.on, combinedTableAliasMapping);
                        joinConditions = joinConditions.concat(onConditions);
                    }
                });
                // Some join conditions may have table undefined as it is implied
                // so we define them explicitly by checking the available tables and finding the suitable table
                // for the undefined table
                joinConditions.forEach(condition => {
                    if (!condition[0].table) {
                        const table = tables.find(t => this.columnsPerTable.find(cpt => cpt.table === t && cpt.columns.includes(condition[0].column)));
                        if (table) {
                            condition[0].table = table;
                        }
                    }
                    if (!condition[1].table) {
                        const table = tables.find(t => this.columnsPerTable.find(cpt => cpt.table === t && cpt.columns.includes(condition[1].column)));
                        if (table) {
                            condition[1].table = table;
                        }
                    }
                });
                // Take any table, consider it joined. Find any join conditions that involve this table
                // add its other table to the joined tables list
                // continue until we cant expand the tree
                // (technically a minimal spanning tree problem)
                const joinedTables: string[] = [tables[0]];
                const remainingConditions = joinConditions.slice();

                while (remainingConditions.length > 0) {
                    const newConditions = remainingConditions.filter(condition => {
                        return (joinedTables.includes(condition[0].table!) && !joinedTables.includes(condition[1].table!)) ||
                               (joinedTables.includes(condition[1].table!) && !joinedTables.includes(condition[0].table!));
                    });
                    if (newConditions.length === 0) {
                        break;
                    }
                    newConditions.forEach(condition => {
                        if (joinedTables.includes(condition[0].table!)) {
                            joinedTables.push(condition[1].table!);
                        } else {
                            joinedTables.push(condition[0].table!);
                        }
                    });
                    for (const condition of newConditions) {
                        const index = remainingConditions.findIndex(c => c[0].table === condition[0].table && c[0].column === condition[0].column && c[1].table === condition[1].table && c[1].column === condition[1].column);
                        if (index !== -1) {
                            remainingConditions.splice(index, 1);
                        }
                    }
                }

                const danglingTables = tables.filter(t => !joinedTables.includes(t));
                if (danglingTables.length > 0) {
                    issues.push(new DanglingTableGroupIssue(danglingTables));
                }

            }
        }

        // Recursively search in child nodes
        this.traverseAst(node, this.findDanglingTableGroups, nextAliasMapping, issues);
        return issues;
    }

    private findIncompleteGroupBy(node: AST, tableAliasMapping: Record<string, string>, issues: IncompleteGroupByIssue[]): IncompleteGroupByIssue[] {
        if (node.type === 'select') {
            const groupByClause = node.groupby;
            const selectClause = node.columns as Column[];

            if (groupByClause && selectClause) {
                const groupByColumns = groupByClause.map((column: ColumnRef) => column.column as string);
                const selectColumns = selectClause.filter(column => column.expr.type === 'column_ref').map((column: Column) => (column.expr as ColumnRef).column as string);

                const missingColumns = selectColumns.filter(column => !groupByColumns.includes(column));
                if (missingColumns.length > 0) {
                    issues.push(new IncompleteGroupByIssue(missingColumns));
                }
            }
        }

        // Recursively search in child nodes
        this.traverseAst(node, this.findIncompleteGroupBy, tableAliasMapping, issues);

        return issues;
    }

    private findForbiddenInnerJoinSyntax(node: AST, issues: ForbiddenInnerJoinSyntaxIssue[]): ForbiddenInnerJoinSyntaxIssue[] {
        if (node.type === 'select') {
            const fromClause = node.from;

            if (fromClause) {
                fromClause.forEach(part => {
                    if ("join" in part && part.join === 'INNER JOIN') {
                        issues.push(new ForbiddenInnerJoinSyntaxIssue());
                    }
                });
            }
        }

        // Recursively search in child nodes
        this.traverseAst(node, this.findForbiddenInnerJoinSyntax, issues);

        return issues;
    }

    analyze(sql: string): Issue[] {
        let asts: AST[];
        try {
            const partialAsts = this.parser.astify(sql);
            asts = Array.isArray(partialAsts) ? partialAsts : [partialAsts];
        } catch (e) {
            if (e instanceof Error && "name" in e && e.name === "SyntaxError") {
                return [new AnalyzerIssue("Unsupported Query Type")];
            }
            console.error(e);
            return [new AnalyzerIssue("Unknown Error, see console for details")];
        }
        try {
            const issues: Issue[] = [];
            for (const ast of asts) {            
                issues.push(...this.findIncompleteJoins(ast, {}, []));
    
                issues.push(...this.findDanglingTableGroups(ast, {}, []));
    
                issues.push(...this.findIncompleteGroupBy(ast, {}, []));
            
                issues.push(...this.findForbiddenInnerJoinSyntax(ast, []));

                // TODO: Useless distinct (when group by is present)

                // TODO: Order by followed by limit is not guaranteed to yield the correct result
            }
            return issues.sort((a, b) => {
                if (a.getSeverity() === b.getSeverity()) {
                    return 0;
                }
                return a.getSeverity() === IssueSeverity.ERROR ? -1 : 1;
            });
        } catch (e) {
            console.error(e);
            return [new AnalyzerIssue("Unknown Error, see console for details")];
        }
    }

}
