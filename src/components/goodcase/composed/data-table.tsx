import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../basic/button";
import { Checkbox } from "../basic/checkbox";
import { Pagination } from "../basic/pagination";
import { AsyncContent } from "./async-content";

export type DataRow = { id: string; name: string; status: string };
export type DataColumn<T> = {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  compare?: (a: T, b: T) => number;
};
type DataTableStateProps<T> = {
  rows: T[];
  caption?: string;
  isSortable?: boolean;
  isSelectable?: boolean;
  isLoading: boolean;
  isRefreshing?: boolean;
  error?: string;
  onRetry: () => void;
  pageSize?: number;
};

export type DataTableProps<T> = DataTableStateProps<T> & {
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
};

type DefaultDataTableProps = DataTableStateProps<DataRow> & {
  columns?: DataColumn<DataRow>[];
  getRowId?: (row: DataRow) => string;
};

const defaultColumns: DataColumn<DataRow>[] = [
  {
    id: "name",
    label: "이름",
    render: (row) => row.name,
    compare: (a, b) => a.name.localeCompare(b.name, "ko"),
  },
  { id: "status", label: "상태", render: (row) => row.status },
];

function getDefaultRowId(row: DataRow) {
  return row.id;
}

function hasCustomModel<T>(
  props: DefaultDataTableProps | DataTableProps<T>,
): props is DataTableProps<T> {
  return props.columns !== undefined && props.getRowId !== undefined;
}

export function DataTable(props: DefaultDataTableProps): ReactNode;
export function DataTable<T>(props: DataTableProps<T>): ReactNode;
export function DataTable<T>(props: DefaultDataTableProps | DataTableProps<T>) {
  if (hasCustomModel(props)) return <DataTableModel {...props} />;
  return (
    <DataTableModel
      {...props}
      columns={props.columns ?? defaultColumns}
      getRowId={props.getRowId ?? getDefaultRowId}
    />
  );
}

function DataTableModel<T>({
  rows,
  columns: activeColumns,
  getRowId: rowId,
  caption = "데이터 목록",
  isSortable = true,
  isSelectable = true,
  isLoading,
  isRefreshing,
  error,
  onRetry,
  pageSize = 3,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [sortId, setSortId] = useState(
    activeColumns.find((column) => column.compare)?.id || "",
  );
  const [isAscending, setIsAscending] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const safePage = Math.min(page, totalPages);
  const comparator = isSortable
    ? activeColumns.find((column) => column.id === sortId)?.compare
    : undefined;
  const sortedRows = comparator
    ? [...rows].sort((a, b) => (isAscending ? 1 : -1) * comparator(a, b))
    : rows;
  const visibleRows = sortedRows.slice(
    (safePage - 1) * safePageSize,
    safePage * safePageSize,
  );
  const hasAllSelected =
    visibleRows.length > 0 &&
    visibleRows.every((row) => selectedIds.includes(rowId(row)));
  const hasSomeSelected = visibleRows.some((row) =>
    selectedIds.includes(rowId(row)),
  );
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [rows, pageSize]);
  function move(next: number) {
    setPage(next);
    setSelectedIds([]);
  }
  return (
    <AsyncContent
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      error={error}
      isEmpty={!rows.length}
      onRetry={onRetry}
    >
      <div
        className="gc-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${caption} 표 스크롤`}
      >
        <table className="gc-c-table">
          <caption>
            {caption}
            {isSelectable && ` · 현재 페이지에서 ${selectedIds.length}개 선택`}
          </caption>
          <thead>
            <tr>
              {isSelectable && (
                <th scope="col">
                  <Checkbox
                    label="현재 페이지 전체 선택"
                    shouldHideLabel
                    isChecked={hasAllSelected}
                    isMixed={hasSomeSelected && !hasAllSelected}
                    onCheckedChange={(isChecked) =>
                      setSelectedIds(isChecked ? visibleRows.map(rowId) : [])
                    }
                  />
                </th>
              )}
              {activeColumns.map((column) => (
                <th
                  scope="col"
                  key={column.id}
                  aria-sort={
                    sortId === column.id && isSortable
                      ? isAscending
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {column.compare && isSortable ? (
                    <Button
                      variant="secondary"
                      className="gc-c-sort"
                      onClick={() => {
                        setIsAscending(
                          sortId === column.id ? !isAscending : true,
                        );
                        setSortId(column.id);
                        setPage(1);
                        setSelectedIds([]);
                      }}
                    >
                      {column.label}{" "}
                      {sortId === column.id ? (isAscending ? "↑" : "↓") : "↕"}
                    </Button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={rowId(row)}>
                {isSelectable && (
                  <td>
                    <Checkbox
                      label={`${rowId(row)} 행 선택`}
                      shouldHideLabel
                      isChecked={selectedIds.includes(rowId(row))}
                      onCheckedChange={(isChecked) =>
                        setSelectedIds(
                          isChecked
                            ? [...selectedIds, rowId(row)]
                            : selectedIds.filter((id) => id !== rowId(row)),
                        )
                      }
                    />
                  </td>
                )}
                {activeColumns.map((column) => (
                  <td key={column.id}>{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={move}
        isLoading={isRefreshing}
      />
    </AsyncContent>
  );
}
