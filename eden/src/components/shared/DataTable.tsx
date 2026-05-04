import { useState } from "react";
import type { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "../ui/button";
import { SectionTitle } from "./SectionTitle";

type DataTableProps<TData> = {
  title?: string;
  data: TData[];
  columns: ColumnDef<TData>[];
  onSelectRow?: (row: TData) => void;
  rowActions?: (row: TData) => ReactNode;
};

export function DataTable<TData>({
  title,
  data,
  columns,
  onSelectRow,
  rowActions,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const actionColumnCount = rowActions ? 1 : 0;
  const columnCount = table.getAllLeafColumns().length + actionColumnCount;

  return (
    <div className="space-y-2">
      {title && <SectionTitle>{title}</SectionTitle>}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="-mx-2"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === "asc" && " asc"}
                      {header.column.getIsSorted() === "desc" && " desc"}
                    </Button>
                  ) : (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-48" />}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={
                  onSelectRow ? () => onSelectRow(row.original) : undefined
                }
                className={onSelectRow ? "cursor-pointer" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                {rowActions && (
                  <TableCell
                    className="w-48 pr-6"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {rowActions(row.original)}
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
