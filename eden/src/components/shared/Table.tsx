import {
    Table as ShadcnTable,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/table";

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
  };

export function Table<T>({ title, data, columns, onSelectRow }: TableProps<T>) {
    return (
        <div>
            {title && <h2 className="text-lg font-semibold mb-2">{title}</h2>}
            <ShadcnTable>
            <TableHeader>
                <TableRow>
                    {columns.map((col) => (
                        <TableHead key={String(col.key)}>{col.header}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((row, i) => (
                    <TableRow key={i} onClick={() => onSelectRow(row)} className="cursor-pointer">
                        {columns.map((col) => (
                            <TableCell key={String(col.key)}>
                                {col.render
                                    ? col.render(row[col.key], row)
                                    : String(row[col.key])}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
            </ShadcnTable>
        </div>
    );
}