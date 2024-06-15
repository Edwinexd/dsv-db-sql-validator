import React from 'react';

interface ResultTableProps {
    columns: string[];
    data: (number | string | Uint8Array | null)[][];
}

const ResultTable: React.FC<ResultTableProps> = ({ columns, data }) => {
    return (
        <table>
            <thead>
                <tr>
                    {columns.map((col) => (
                        <th key={col}>{col}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row, i) => (
                    <tr key={i}>
                        {row.map((cell, j) => (
                            <td key={j}>{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default ResultTable;
