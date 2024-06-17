import React, { useState } from 'react';
import Editor from 'react-simple-code-editor';
// @ts-ignore
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism.css';

import 'prismjs/themes/prism.css';
import { format } from 'sql-formatter';

interface View {
    name: string;
    query: string;
  }

interface ViewsTableProps {
    views: View[];
    onRemoveView: (name: string) => void;
}

const ViewsTable: React.FC<ViewsTableProps> = ({ views, onRemoveView }) => {
    return (
        <>
            <h2 className='text-3xl font-semibold mb-3.5'>Views</h2>
            <table className="table-auto text-xl dark:bg-slate-700 bg-slate-300">
                <thead>
                    <tr>
                        <th className="border dark:border-slate-600 px-4 py-2 dark:bg-slate-600 bg-slate-200">Name</th>
                        <th className="border dark:border-slate-600 px-4 py-2 dark:bg-slate-600 bg-slate-200">Query</th>
                        <th className="border dark:border-slate-600 px-4 py-2 dark:bg-slate-600 bg-slate-200">Delete</th>
                    </tr>
                </thead>
                <tbody>
                    {views.map((view) => (
                        <tr key={view.name}>
                            <td className="border dark:border-slate-600 px-4 py-2">{view.name}</td>
                            <td className="border dark:border-slate-600 px-4 py-2">
                                <HideableEditor query={view.query} />
                            </td>
                            <td className="border dark:border-slate-600 px-4 py</td>-2">
                                <button className='bg-red-500 hover:bg-red-700 text-white text-xl font-semibold py-2 px-4 my-4 rounded w-24' onClick={() => {
                                    onRemoveView(view.name);
                                }}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
};

const HideableEditor: React.FC<{ query: string }> = ({ query }) => {
    const [isVisible, setIsVisible] = useState(false);
    return (
        <div>
            {isVisible && (
                <Editor
                    readOnly={true}
                    value={format(query, {
                        language: 'sqlite',
                        tabWidth: 2,
                        useTabs: false,
                        keywordCase: 'upper',
                        dataTypeCase: 'upper',
                        functionCase: 'upper',
                    })}
                    onValueChange={() => null}
                    highlight={code => highlight(code, languages.sql)}
                    padding={10}
                    tabSize={4}
                    className="font-mono text-xl w-max dark:bg-slate-800 bg-slate-200 border-2 min-h-40 border-none my-2"
                />
            )}
            <button
                className='bg-blue-500 hover:bg-blue-700 text-white text-xl font-semibold py-2 px-4 my-4 rounded w-24'
                onClick={() => setIsVisible(!isVisible)}
            >
                {isVisible ? 'Hide' : 'Show'}
            </button>
        </div>
    );
};


export default ViewsTable;
