import React from 'react';

interface ResultTableProps {
    columns: string[];
    data: (number | string | Uint8Array | null)[][];
}

const ResultTable: React.FC<ResultTableProps> = ({ columns, data }) => {
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
            <table className="table-auto text-sm bg-slate-50 dark:bg-slate-700">
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col} className="border border-slate-600 px-4 py-2 dark:bg-slate-600">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j} className="border border-slate-600 px-4 py-2">{cell}</td>
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
