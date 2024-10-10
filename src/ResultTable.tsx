import React from 'react';
import { Result } from './utils';

interface ResultTableProps {
    result: Result;
    forceLight?: boolean;
}

const ResultTable: React.FC<ResultTableProps> = ({ result, forceLight }) => {
    const maybeRemoveDark = (className: string) => {
        if (forceLight) {
            return '';
        }
        return className;
    }


    const columns = result.columns;
    let data = result.data;
    
    if (data.length === 0) {
        return <div>No results</div>;
    }
    let sliced = 0;
    // Dont display more than 100 rows
    if (data.length > 100) {
        sliced = data.length - 100;
        data = data.slice(0, 100);
    }
    return (
        <>
            <table className={`table-auto text-sm ${maybeRemoveDark("dark:bg-slate-700")} bg-slate-300`}>
                <thead>
                    <tr>
                        {columns.map((col, i) => (
                            <th key={col + "-" + i} className={`border ${maybeRemoveDark("dark:border-slate-600 dark:bg-slate-600")} px-4 py-2 bg-slate-200`}>{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={i + "-" + j} className={`border ${maybeRemoveDark("dark:border-slate-600")} px-4 py-2`}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {sliced !== 0 && <div>
                <p className="italic">... and {sliced} more rows</p>
            </div>}
        </>
    );
};

export default ResultTable;
