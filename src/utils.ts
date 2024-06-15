
interface Result {
    columns: string[];
    data: (number | string | Uint8Array | null)[][];
}


export function isCorrectResult(expected: Result, actual: Result) {
    // Results may have a different ordering of both columns and data
    // column names may differ but it should still be considered correct
    // if the data is the same

    // Check if the columns are the same
    if (expected.columns.length !== actual.columns.length) {
        return false;
    }

    let globalCandidates: { [key: number]: number[] } = {};
    // For each column in expected, try to see if it exists in actual
    for (let i = 0; i < expected.columns.length; i++) {
        let candidates = [];
        for (let j = 0; j < actual.columns.length; j++) {
            const dataInExpected = expected.data.map(row => row[i]);
            const dataInActual = actual.data.map(row => row[j]);

            if (dataInExpected.length === dataInActual.length) {
                // Make copy of both data arrays
                dataInExpected.sort();
                dataInActual.sort();
                // Compare the data
                let failed = false;
                for (let k = 0; k < dataInExpected.length; k++) {
                    if (dataInExpected[k] !== dataInActual[k]) {
                        console.log('Data mismatch', dataInExpected[k], dataInActual[k])
                        failed = true;
                        break;
                    }
                }
                if (!failed) {
                    candidates.push(j);
                }
            }
        }
        if (candidates.length === 0) {
            return false;
        }
        globalCandidates[i] = candidates;
    }

    // Try matching globalCandidates so each key has a unique value
    const usedColumns = new Set<number>();
    const matchColumns = (index: number): boolean => {
        if (index === expected.columns.length) {
            return true;
        }
        for (const candidate of globalCandidates[index]) {
            if (!usedColumns.has(candidate)) {
                usedColumns.add(candidate);
                if (matchColumns(index + 1)) {
                    return true;
                }
                usedColumns.delete(candidate);
            }
        }
        return false;
    };

    return matchColumns(0);
}
