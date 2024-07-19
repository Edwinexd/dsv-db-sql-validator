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

class MatchesResult {
    matches: number[][] = [];
    constructor(matches: number[][]) {
        this.matches = matches;
    }

    isAny() {
        return this.matches.length > 0;
    }
}

class HashedValue {
    private value: number | string | Uint8Array | null;
    private hashCache?: bigint;

    constructor(value: number | string | Uint8Array | null) {
        this.value = value;
    }

    getHash() {
        if (this.hashCache === undefined) {
            if (typeof this.value === 'string') {
                this.hashCache = BigInt(cyrb53(this.value));
            } else if (typeof this.value === 'number') {
                this.hashCache = BigInt(this.value);
            } else if (this.value === null) {
                this.hashCache = BigInt(17);
            } else {
                this.hashCache = BigInt(17);
                for (let i = 0; i < this.value.length; i++) {
                    this.hashCache += BigInt(this.value[i]);
                }
            }
        }
        return this.hashCache;
    }

    equals(other: HashedValue): boolean {
        if (typeof this.value !== typeof other.value || this.getHash() !== other.getHash()) {
            return false;
        }

        if (this.value === other.value) {
            return true;
        }

        if (this.value instanceof Uint8Array && other.value instanceof Uint8Array) {
            if (this.value.length !== other.value.length) {
                return false;
            }
            for (let i = 0; i < this.value.length; i++) {
                if (this.value[i] !== other.value[i]) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }
}

class HashedRow {
    private values: HashedValue[] = [];
    private hashCache?: bigint;

    constructor(data: (number | string | Uint8Array | null)[]) {
        this.values = data.map(value => new HashedValue(value));
    }

    getHash() {
        if (this.hashCache === undefined) {
            this.hashCache = BigInt(17);
            for (const value of this.values) {
                this.hashCache += value.getHash();
            }
        }
        return this.hashCache;
    }

    /**
     * Assumes hash is equal of the two rows and that they have the same amount of values
     * @param other 
     * @param mapping 
     * @returns 
     */
    private equalsWithOrder(other: HashedRow, mapping: number[]): boolean {
        for (let i = 0; i < this.values.length; i++) {
            if (!this.values[i].equals(other.values[mapping[i]])) {
                return false;
            }
        }
        return true;
    }

    /**
     * 
     * @param index which value to match next
     * @param used which values (indexes from otherValues) have been used where
     * @param otherValues the values we are trying to match
     * @returns the mappings of which the the values in the input row have to be ordered to match this row
     * e.x. [[1, 0, 2]] means that the first value in the input row has to be matched with the second value in this row,
     * the second value in the input row has to be matched with the first value in this row
     * and the third value in the input row has to be matched with the third value in this row
     */
    private backtrackingMatches(index: number, used: number[], otherValues: HashedValue[]): number[][] {
        if (index === this.values.length) {
            // Copy of array as backtracking upwards pops and hence modifies the array
            return [used.concat()];
        }

        const mappings: number[][] = [];
        for (let i = 0; i < otherValues.length; i++) {
            if (used.includes(i)) {
                // Value can only be used once
                continue;
            }
            if (this.values[index].equals(otherValues[i])) {
                used.push(i);
                mappings.push(...this.backtrackingMatches(index + 1, used, otherValues));
                used.pop();
            }
        }
        return mappings;
    }

    /**
     * 
     * @param other the row to match against
     * @param mappings which mappings to attempt, otherwise all mappings are attempted via an backtracking algorithm
     * @returns the mappings of which the the values in the input row have to be ordered to match this row
     */
    matches(other: HashedRow, mappings: number[][] | null = null): MatchesResult {
        if (this.values.length !== other.values.length || this.getHash() !== other.getHash()) {
            return new MatchesResult([]);
        }

        if (mappings === null) {
            // Use backtracking to find all possible mappings
            return new MatchesResult(this.backtrackingMatches(0, [], other.values));
        }

        return new MatchesResult(mappings.filter(mapping => this.equalsWithOrder(other, mapping)));
    }

    /**
     * @deprecated Use matches instead
     * @param other 
     * @returns 
     */
    equals(other: HashedRow) {
        if (this.values.length !== other.values.length || this.getHash() !== other.getHash()) {
            return false;
        }

        // Try match all values in this set to the other set
        return this.backtrackCompare(0, new Array<boolean>(other.values.length).fill(false), other.values);
    }

    /**
     * @deprecated Use matches instead
     * @param index 
     * @param used 
     * @param otherValues 
     * @returns 
     */
    private backtrackCompare(index: number, used: boolean[], otherValues: HashedValue[]): boolean {
        if (index === this.values.length) {
            return true;
        }

        for (let i = 0; i < otherValues.length; i++) {
            if (!used[i] && this.values[index].equals(otherValues[i])) {
                used[i] = true;
                if (this.backtrackCompare(index + 1, used, otherValues)) {
                    return true;
                }
                used[i] = false;
            }
        }

        return false;
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

    remove(row: HashedRow, mappings: number[][] | null = null): MatchesResult {
        const bucket = this.getBucket(row);
        let index = -1;
        let workingMappings: number[][] = [];
        for (let i = 0; i < bucket.length; i++) {
            const match = bucket[i].matches(row, mappings);
            if (match.isAny()) {
                index = i;
                workingMappings = match.matches;
                break;
            }
        }
        if (index !== -1) {
            bucket.splice(index, 1);
        }
        return new MatchesResult(workingMappings);
    }

    contains(row: HashedRow, mappings: number[][] | null = null): MatchesResult {
        const bucket = this.getBucket(row);
        for (let i = 0; i < bucket.length; i++) {
            const match = bucket[i].matches(row, mappings);
            if (match.isAny()) {
                return new MatchesResult(match.matches);
            }
        }
        return new MatchesResult([]);
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
    // in this case it dosn't matter which set is made into a hashset as both are guaranteed to have the same amount of rows
    const actualRowsSet = new RowHashSet(actualRows.length);

    for (const row of actualRows) {
        actualRowsSet.add(row);
    }

    let mappings = null;
    for (const row of expectedRows) {
        const matches = actualRowsSet.remove(row, mappings);
        if (!matches.isAny()) {
            return false;
        }
        mappings = matches.matches;
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

class UselessDistinctIssue extends Issue {
    constructor() {
        super('USELESS_DISTINCT', IssueSeverity.WARNING);
    }

    toString() {
        return 'DISTINCT has no effect when a correct GROUP BY clause is present';
    }
}

class NullFilteredOuterJoinIssue extends Issue {
    constructor(public column: string, public table: string, public joinType: 'LEFT' | 'RIGHT') {
        super('NULL_FILTERED_OUTER_JOIN', IssueSeverity.WARNING);
    }

    toString() {
        return `Null filtering on column ${this.column} in OUTER ${this.joinType} JOIN with table ${this.table}`;
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

    extractNullFilters(whereClause: Expr | Function, tableAliasMapping: Record<string, string>) {
        const nullFilters: { table: string, column: string, joinType: 'LEFT' | 'RIGHT' }[] = [];

        if (whereClause.type === 'binary_expr' && whereClause.operator === 'IS' && whereClause.right.type === 'null') {
            if (whereClause.left.type === 'column_ref') {
                const column = whereClause.left as ColumnRef;
                const table = column.table ? tableAliasMapping[column.table] || column.table : null;
                if (table) {
                    nullFilters.push({
                        table,
                        column: column.column as string,
                        joinType: 'LEFT'
                    });
                }
            }
        } else if (whereClause.type === 'binary_expr' && whereClause.operator === 'AND') {
            nullFilters.push(...this.extractNullFilters(whereClause.left as Expr | Function, tableAliasMapping));
            nullFilters.push(...this.extractNullFilters(whereClause.right as Expr | Function, tableAliasMapping));
        }

        return nullFilters;
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

    private findUselessDistinct(node: AST, issues: UselessDistinctIssue[]): UselessDistinctIssue[] {
        if (node.type === 'select') {
            const distinct = node.distinct;
            const groupBy = node.groupby;

            if (distinct && groupBy) {
                issues.push(new UselessDistinctIssue());
            }
        }

        // Recursively search in child nodes
        this.traverseAst(node, this.findUselessDistinct, issues);

        return issues;
    }

    private findNullFilteredOuterJoin(node: AST, tableAliasMapping: Record<string, string>, issues: NullFilteredOuterJoinIssue[]): NullFilteredOuterJoinIssue[] {
        let nextAliasMapping = { ...tableAliasMapping };
        // Find outer joins
        // for left joins, note which columns are used in the join condition for the right table
        // if any of those columns have a IS NULL condition or in the WHERE claus, warn.
        // for right joins, note which columns are used in the join condition for the left table
        // if any of those columns have a IS NULL condition there or in the WHERE claus, warn.
        if (node.type === 'select') {
            const fromClause = node.from;
            const whereClause = node.where;

            if (fromClause) {
                const localTableAliasMapping = this.extractTableAliasMapping(fromClause);
                const combinedTableAliasMapping = { ...tableAliasMapping, ...localTableAliasMapping };
                nextAliasMapping = { ...combinedTableAliasMapping}
                const tables = Object.values(combinedTableAliasMapping);

                fromClause.forEach(part => {
                    if ("join" in part) {
                        const join = part as Join;
                        if (join.join === 'INNER JOIN') {
                            return;
                        }
                        if (!join.on) {
                            // Other join without ON clause is not supported
                            return;
                        }
                        const joinConditions = this.extractJoinConditions(join.on, combinedTableAliasMapping);
                        // Solve null condition.tables with the alias mapping
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

                        let nullFilters = whereClause ? this.extractNullFilters(whereClause, combinedTableAliasMapping) : [];
                        nullFilters = nullFilters.concat(this.extractNullFilters(join.on, combinedTableAliasMapping));

                        console.log(nullFilters);
                    }
                }
                );
            }
        }

        // Recursively search in child nodes
        this.traverseAst(node, this.findNullFilteredOuterJoin, nextAliasMapping, issues);
        
        return issues;
    }

    analyze(sql: string): Issue[] {
        let asts: AST[];
        try {
            let query = sql;
            query = sql.replace(/OUTER\s+(LEFT|RIGHT)\s+JOIN/gi, "$1 JOIN");
            // this parser does not support å ä ö on anyting so we replace it before parsing
            query = query.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
            // same replacements on all tables columns and join rules
            this.columnsPerTable.forEach(cpt => {
                cpt.table = cpt.table.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
                cpt.columns = cpt.columns.map(col => col.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o'));
            });
            this.joinRules.forEach(jr => {
                jr.table1 = jr.table1.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
                jr.column1 = jr.column1.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
                jr.table2 = jr.table2.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
                jr.column2 = jr.column2.replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
            });
        
            const partialAsts = this.parser.astify(query, { database: 'sqlite' });
            asts = Array.isArray(partialAsts) ? partialAsts : [partialAsts];
        } catch (e) {
            if (e instanceof Error && "name" in e && e.name === "SyntaxError") {
                console.error(e);
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

                issues.push(...this.findUselessDistinct(ast, []));

                // TODO: Order by followed by limit is not guaranteed to yield the correct result
                // Not sure how to describe this in a meaningful way without causing confusion / Edwin 2024-06-25

                // TODO: Outer joins with null filtering should be a inner join instead
                issues.push(...this.findNullFilteredOuterJoin(ast, {}, []));

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
