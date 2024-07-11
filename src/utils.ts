
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
