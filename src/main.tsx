import React, { CSSProperties, useState } from 'react'
import ReactDOM from 'react-dom/client'

//
import './index.css'

//
import {
  Column,
  Table,
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  RowData
} from '@tanstack/react-table'
import { makeData, Person } from './makeData'

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void
  }
}

const defaultTableCss = { table: undefined, thead: undefined, th: undefined, tbody: undefined, tr: undefined, td: undefined }

// Give our default column cell renderer editing superpowers!
const defaultColumn: Partial<ColumnDef<any>> = {
  // eslint-disable-next-line
  cell: ({ getValue, row: { index }, column: { id, columnDef: { inputType, options, optionDefault, selectDisableOptionFn, disableControl, selectDisableFn, customCellComponent }, }, table }) => {
    const initialValue = getValue()
    // We need to keep and update the state of the cell normally
    const [value, setValue] = React.useState(initialValue)

    // When the input is blurred, we'll call our table meta's updateData function
    const onBlur = () => {
      table.options.meta?.updateData(index, id, value)
    }

    // If the initialValue is changed external, sync it up with our state
    React.useEffect(() => {
      setValue(initialValue)
    }, [initialValue])

    if (customCellComponent) {
      return customCellComponent(value, setValue, onBlur);
    }

    switch (inputType) {
      case 'text':
        return <input
          value={value as string}
          onChange={e => setValue(e.target.value)}
          onBlur={onBlur}
          disabled={disableControl}
        />
      case 'select':
        return <select onChange={e => setValue(e.target.value)} onBlur={onBlur} value={value as string} defaultValue={optionDefault ?? undefined} disabled={selectDisableFn && selectDisableFn()}>
          {options?.map((item: { id: string, value: string }) =>
            <option key={item.id} value={item.value} disabled={selectDisableOptionFn && selectDisableOptionFn(item)}>{item.value}</option>)}
        </select>
      case 'checkbox':
        return <input type="checkbox" onChange={e => setValue(e.target.checked)} checked={value as boolean} onBlur={onBlur} disabled={disableControl} />
      default:
        return value as string;
    }
  },
}

function useSkipper() {
  const shouldSkipRef = React.useRef(true)
  const shouldSkip = shouldSkipRef.current

  // Wrap a function with this to skip a pagination reset temporarily
  const skip = React.useCallback(() => {
    shouldSkipRef.current = false
  }, [])

  React.useEffect(() => {
    shouldSkipRef.current = true
  })

  return [shouldSkip, skip] as const
}

function App() {
  const rerender = React.useReducer(() => ({}), {})[1]
  const [changedRows, setChangedRows] = useState(new Map());
  const [num, setNum] = useState(1)
  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      {
        header: 'Name',
        footer: props => props.column.id,
        columns: [
          {
            accessorKey: 'firstName',
            footer: props => props.column.id,
            inputType: 'text',
            enableColumnFilter: false,
          },
          {
            accessorFn: row => row.lastName,
            id: 'lastName',
            header: () => <span>Last Name</span>,
            footer: props => props.column.id,
          },
        ],
      },
      {
        header: 'Info',
        footer: props => props.column.id,
        columns: [
          {
            accessorKey: 'age',
            header: () => 'Age',
            footer: props => props.column.id,
            customCellComponent: (value: any, onChange: any, onBlur: any) => <input type="number" value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}></input>
          },
          {
            header: 'More Info',
            columns: [
              {
                accessorKey: 'visits',
                canFilter: false,
                header: () => <span>Visits</span>,
                footer: props => props.column.id,
              },
              {
                accessorKey: 'status',
                header: 'Status',
                footer: props => props.column.id,
                inputType: 'select',
                options: [{ id: 1, value: "complicated" }, { id: 2, value: "single" }, { id: 3, value: "relationship" }],
                defaultValue: 2,
                selectDisableOptionFn: (item: { id: number | string, value: string }) => item.id === 2
              },
              {
                accessorKey: 'gender',
                header: 'Gender',
                footer: props => props.column.id,
                inputType: 'checkbox',
                disableControl: true
              },
              {
                accessorKey: 'progress',
                header: 'Profile Progress',
                footer: props => props.column.id,
              },
            ],
          },
        ],
      },
    ],
    []
  )

  const [data, setData] = React.useState(() => makeData(1000))
  const refreshData = () => setData(() => makeData(1000))

  const getChangedRows = () => {
    if (changedRows && changedRows.size > 0) {
      console.log(changedRows)
    }
  }

  return <>
    <button onClick={getChangedRows}>Get changed Rows</button>
    <EditableTable data={data} setData={setData} rowChangeHandler={setChangedRows} columns={columns} refreshData={refreshData} rerender={rerender} customClassNames={{ table: 'content-table' }} pagination={'Client'} />
  </>
}

type CSSPropertiesStyle = CSSProperties | undefined

type TableStyles<T> = Partial<{ table: T, thead: T, th: T, tbody: T, tr: T, td: T }>;

type EditableTableOptions<T> = {
  data: Array<T>,
  setData: React.Dispatch<React.SetStateAction<Array<T>>>,
  columns: any,
  refreshData: any,
  rerender: any
  rowChangeHandler: React.Dispatch<React.SetStateAction<Map<any, any>>>,
  customStyles?: TableStyles<CSSPropertiesStyle>,
  customClassNames?: TableStyles<string | undefined>,
  pagination?: "Client" | "Server",
  filterable?: boolean
}

const EditableTable = ({ data, setData, columns, rowChangeHandler, refreshData, rerender, customStyles = defaultTableCss, customClassNames = defaultTableCss, pagination = undefined, filterable = false }: EditableTableOptions<any>) => {
  console.count("table")
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper()

  const table = useReactTable({
    data,
    columns,
    defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex,
    enableFilters: filterable,
    // Provide our updateData function to our table meta
    meta: {
      updateData: (rowIndex, columnId, value) => {
        // Skip age index reset until after next rerender
        skipAutoResetPageIndex()
        setData(old =>
          old.map((row, index) => {
            if (index === rowIndex) {
              let hasChanged = false;
              if (old[rowIndex][columnId] !== value)
                hasChanged = true;
              const newData = {
                ...old[rowIndex]!,
                [columnId]: value
              }
              if (hasChanged)
                rowChangeHandler(prev => prev.set(rowIndex, newData))
              return newData;
            }
            return row
          })
        )
      },
    },
    debugTable: true,
  })

  return (
    <div className="p-2">
      <div className="h-2" />
      <table className={customClassNames.table} style={customStyles.table}>
        <thead className={customClassNames.thead} style={customStyles.thead}>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} style={customStyles.tr}>
              {headerGroup.headers.map(header => {
                return (
                  <th key={header.id} colSpan={header.colSpan} style={customStyles.th}>
                    {header.isPlaceholder ? null : (
                      <div>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanFilter() ? (
                          <div>
                            <Filter column={header.column} table={table} />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody style={customStyles.tbody}>
          {table.getRowModel().rows.map(row => {
            return (
              <tr key={row.id} style={customStyles.tr}>
                {row.getVisibleCells().map(cell => {
                  return (
                    <td key={cell.id} style={customStyles.td}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="h-2" />
      {pagination && <div className="flex items-center gap-2">
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          {'<<'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {'<'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {'>'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {'>>'}
        </button>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </strong>
        </span>
        <span className="flex items-center gap-1">
          | Go to page:
          <input
            type="number"
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={e => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0
              table.setPageIndex(page)
            }}
            className="border p-1 rounded w-16"
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => {
            table.setPageSize(Number(e.target.value))
          }}
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>}
      <div>{table.getRowModel().rows.length} Rows</div>
      <div>
        <button onClick={() => rerender()}>Force Rerender</button>
      </div>
      <div>
        <button onClick={() => refreshData()}>Refresh Data</button>
      </div>
    </div>
  )
}
function Filter({
  column,
  table,
}: {
  column: Column<any, any>
  table: Table<any>
}) {
  const firstValue = table
    .getPreFilteredRowModel()
    .flatRows[0]?.getValue(column.id)

  const columnFilterValue = column.getFilterValue()

  return typeof firstValue === 'number' ? (
    <div className="flex space-x-2">
      <input
        type="number"
        value={(columnFilterValue as [number, number])?.[0] ?? ''}
        onChange={e =>
          column.setFilterValue((old: [number, number]) => [
            e.target.value,
            old?.[1],
          ])
        }
        placeholder={`Min`}
        className="w-24 border shadow rounded"
      />
      <input
        type="number"
        value={(columnFilterValue as [number, number])?.[1] ?? ''}
        onChange={e =>
          column.setFilterValue((old: [number, number]) => [
            old?.[0],
            e.target.value,
          ])
        }
        placeholder={`Max`}
        className="w-24 border shadow rounded"
      />
    </div>
  ) : (
    <input
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder={`Search...`}
      className="w-36 border shadow rounded"
    />
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
