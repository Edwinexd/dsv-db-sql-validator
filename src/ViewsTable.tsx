import "prismjs/components/prism-sql";
import "prismjs/themes/prism.css";
import React from "react";
import WordBreakText from "./WordBreakText";

export interface View {
  name: string;
  query: string;
}

interface ViewsTableProps {
  views: View[];
  currentlyQuriedView: string | null;
  onRemoveView: (name: string) => void;
  onViewRequest(name: string): void;
  onViewHideRequest(): void;
  onViewExportRequest(name: string): void;
}

const ViewsTable: React.FC<ViewsTableProps> = ({ views, currentlyQuriedView, onRemoveView, onViewRequest, onViewHideRequest, onViewExportRequest }) => {
  return (
    <>
      <h2 className="text-3xl font-semibold mb-3.5">Views</h2>
      <div className="w-full max-w-2xl overflow-x-auto">
        <table className="table-auto text-xl dark:bg-slate-700 bg-slate-300 m-auto">
          <thead>
            <tr>
              <th className="border dark:border-slate-600 px-4 py-2 dark:bg-slate-600 bg-slate-200">Name</th>
              <th className="border dark:border-slate-600 px-4 py-2 dark:bg-slate-600 bg-slate-200">Query and Result</th>
              <th className="border dark:border-slate-600 px-4 py-2 dark:bg-slate-600 bg-slate-200">Export PNG</th>
              <th className="border dark:border-slate-600 px-4 py-2 dark:bg-slate-600 bg-slate-200">Delete</th>
            </tr>
          </thead>
          <tbody>
            {views.map((view) => (
              <tr key={view.name}>
                <td className="border dark:border-slate-600 px-4 py-2"><WordBreakText text={view.name} /></td>
                <td className="border dark:border-slate-600 px-4 py-2">
                  {currentlyQuriedView === view.name ? (
                    <button className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xl font-semibold py-2 px-4 my-4 w-full max-w-40 rounded" onClick={() => {onViewHideRequest();}}>
                      Hide
                    </button>
                  ) : (
                    <button className="bg-blue-500 hover:bg-blue-700 text-white text-xl font-semibold py-2 px-4 my-4 w-full max-w-40 rounded" onClick={() => {
                      onViewRequest(view.name);
                    }}>Display</button>
                  )}
                </td>
                <td className="border dark:border-slate-600 px-4 py-2">
                  <button className="bg-green-500 hover:bg-green-700 text-white text-xl font-semibold py-2 px-4 my-4 w-full max-w-40 rounded" onClick={() => {
                    onViewExportRequest(view.name);
                  }}>Export</button>
                </td>
                <td className="border dark:border-slate-600 px-4 py</td>-2">
                  <button className="bg-red-500 hover:bg-red-700 text-white text-xl font-semibold py-2 px-4 my-4 w-full max-w-40 rounded" onClick={() => {
                    onRemoveView(view.name);
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default ViewsTable;
