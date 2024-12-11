import React from "react";
import { Result } from "./utils";

interface ResultTableProps {
  result: Result;
  forceLight?: boolean;
  forceFixedSizes?: boolean;
}

const ResultTable: React.FC<ResultTableProps> = ({ result, forceLight, forceFixedSizes }) => {
  const maybeRemoveDark = (className: string) => {
    if (forceLight) {
      return "";
    }
    return className;
  };

  const maybeFixedSizes = (className: string): string => {
    if (className.includes(" ")) {
      return className.split(" ").map((c) => maybeFixedSizes(c.trim())).join(" ");
    }
    if (forceFixedSizes) {
      if (className === "text-sm") return "text-[14px] leading-[20px]";
      // .px-4 {
      // padding-left: 1rem /* 16px */;
      // padding-right: 1rem /* 16px */;
      if (className === "px-4") return "px-[16px]";
      // .py-2 {
      // padding-top: 0.5rem /* 8px */;
      // padding-bottom: 0.5rem /* 8px */
      if (className === "py-2") return "py-[8px]";
      if (className === "whitespace-normal") return "whitespace-nowrap";
    }
    return className;
  };


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
      <table className={`table-auto ${maybeFixedSizes("text-sm")} ${maybeRemoveDark("dark:bg-slate-700")} bg-slate-300`}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={col + "-" + i} className={`border ${maybeRemoveDark("dark:border-slate-600 dark:bg-slate-600")} ${maybeFixedSizes("px-4 py-2")} bg-slate-200`}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={i + "-" + j} className={`border ${maybeRemoveDark("dark:border-slate-600")} ${maybeFixedSizes("px-4 py-2")} ${maybeFixedSizes("whitespace-normal")}`}>
                  {cell !== null ? <span>{cell}</span> : <span className="italic" title="NULL: No value">NULL</span>}
                </td>
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
