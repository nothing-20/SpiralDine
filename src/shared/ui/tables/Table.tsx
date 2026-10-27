import React from 'react';
import { cn } from '../../../utils/cn';

export interface ITableColumn<T> {
  header: React.ReactNode;
  accessor: (row: T) => React.ReactNode;
  className?: string;
}

export interface ITableProps<T> {
  columns: ITableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, idx: number) => string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  className
}: ITableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-slate-800/40 bg-slate-950/20", className)}>
      <table className="w-full text-left border-collapse">
        {/* Table Headers */}
        <thead>
          <tr className="border-b border-slate-800/50 bg-slate-900/30">
            {columns.map((col, idx) => (
              <th 
                key={idx} 
                className={cn("p-4 text-xs font-semibold text-slate-400 uppercase select-none", col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body rows */}
        <tbody className="divide-y divide-slate-800/30 text-xs">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-mutedAsh">
                No active records.
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr 
                key={keyExtractor(row, rowIdx)}
                className="hover:bg-slate-900/20 transition-all duration-150"
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={cn("p-4 text-slate-300", col.className)}>
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
export default Table;
