import React from 'react';

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
                            <td className="border dark:border-slate-600 px-4 py-2">{view.query}</td>
                            <td className="border dark:border-slate-600 px-4 py-2">
                                <button className='bg-red-500 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded' onClick={() => {
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

export default ViewsTable;
