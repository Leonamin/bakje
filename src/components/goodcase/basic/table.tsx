import type { ReactNode } from "react";

export function Table({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: ReactNode[];
  rows: ReactNode[][];
}) {
  return (
    <div
      className="gc-table-wrap"
      tabIndex={0}
      role="region"
      aria-label={`${caption} 표 스크롤`}
    >
      <table className="gc-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th scope="col" key={index}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
