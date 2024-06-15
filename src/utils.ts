
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
