"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/locale-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

export interface ResponsiveDataListColumn<T> {
  key: string;
  label: string;
  render: (item: T) => React.ReactNode;
  align?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
  /** On mobile cards, show as primary line (bold, larger) */
  prominent?: boolean;
}

export interface ResponsiveDataListProps<T> {
  items: T[];
  columns: ResponsiveDataListColumn<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage: React.ReactNode;
  /** Optional actions rendered per row (table: in cell, card: at bottom) */
  renderActions?: (item: T) => React.ReactNode;
  /** Breakpoint for table vs cards. Default: sm (640px) */
  tableBreakpoint?: "sm" | "md";
}

export function ResponsiveDataList<T>({
  items,
  columns,
  keyExtractor,
  emptyMessage,
  renderActions,
  tableBreakpoint = "sm",
}: ResponsiveDataListProps<T>) {
  const { t } = useLocale();
  const tableWrapperClass = tableBreakpoint === "sm" ? "hidden sm:block" : "hidden md:block";
  const cardsClass = tableBreakpoint === "sm" ? "sm:hidden" : "md:hidden";

  return (
    <>
      {/* Table view (desktop) */}
      <div className={cn("overflow-x-auto", tableWrapperClass)}>
        <Table className="min-w-[480px]">
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  scope="col"
                  className={cn(
                    col.align === "right" && "text-right",
                    col.headerClassName
                  )}
                >
                  {col.label}
                </TableHead>
              ))}
              {renderActions && <TableHead className="text-right">{t("common.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (renderActions ? 1 : 0)}
                  className="text-center text-dark-6"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={keyExtractor(item)}>
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right",
                        col.cellClassName
                      )}
                    >
                      {col.render(item)}
                    </TableCell>
                  ))}
                  {renderActions && (
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        {renderActions(item) || "—"}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Card view (mobile) */}
      <div className={cn("space-y-3", cardsClass)}>
        {items.length === 0 ? (
          <div className="rounded-lg border border-stroke bg-gray-50 p-6 text-center text-dark-6 dark:border-dark-3 dark:bg-dark-2">
            {emptyMessage}
          </div>
        ) : (
          items.map((item) => {
            const prominentCol = columns.find((c) => c.prominent);
            const otherCols = columns.filter((c) => !c.prominent);
            return (
              <div
                key={keyExtractor(item)}
                className="rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-gray-dark"
              >
                {prominentCol && (
                  <div className="mb-3 font-semibold text-dark dark:text-white">
                    {prominentCol.render(item)}
                  </div>
                )}
                <div className="space-y-2">
                  {otherCols.map((col) => (
                    <div
                      key={col.key}
                      className={cn(
                        "flex justify-between gap-3 text-sm",
                        col.align === "right" && "flex-row-reverse"
                      )}
                    >
                      <span className="shrink-0 text-dark-6 dark:text-dark-5">
                        {col.label}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 break-words text-right",
                          col.align !== "right" && "text-left"
                        )}
                      >
                        {col.render(item)}
                      </span>
                    </div>
                  ))}
                </div>
                {renderActions && renderActions(item) && (
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-stroke pt-3 dark:border-dark-3">
                    {renderActions(item)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
