import {
  Table as ShadcnTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { SectionTitle } from "./SectionTitle";

type Column<T> = {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
};

type TableProps<T> = {
  title: string;
  data: T[];
  columns: Column<T>[];
  onSelectRow: (row: T) => void;
  rowActions?: (row: T) => React.ReactNode;
};

export function Table<T>({
  title,
  data,
  columns,
  onSelectRow,
  rowActions,
}: TableProps<T>) {
  return (
    <div>
      {title && <SectionTitle>{title}</SectionTitle>}
      <ShadcnTable>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={String(col.key)}>{col.header}</TableHead>
            ))}
            {rowActions && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow
              key={i}
              onClick={() => onSelectRow(row)}
              className="cursor-pointer"
            >
              {columns.map((col) => (
                <TableCell key={String(col.key)}>
                  {col.render
                    ? col.render(row[col.key], row)
                    : String(row[col.key])}
                </TableCell>
              ))}
              {rowActions && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {rowActions(row)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </ShadcnTable>
    </div>
  );
}
