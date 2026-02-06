import React, { useState, useMemo } from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  getFilterValues?: (data: T[]) => string[];
  filterValue?: (item: T, filterValue: string) => boolean;
}

export interface EnhancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  customActions?: (item: T) => React.ReactNode;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function EnhancedTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  onEdit,
  onDelete,
  onView,
  customActions,
  searchPlaceholder = "Search...",
  emptyMessage = "No data found"
}: EnhancedTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Get nested value from object using dot notation
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  // Handle column filter
  const handleColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => {
        return columns.some(column => {
          if (column.searchable === false) return false;
          const value = getNestedValue(item, column.key as string);
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(item => {
          // Find the column configuration
          const column = columns.find(col => col.key === columnKey);
          
          // If column has custom filter logic, use it
          if (column?.filterValue) {
            return column.filterValue(item, filterValue);
          }
          
          // Otherwise use default filter logic
          const value = getNestedValue(item, columnKey);
          return value?.toString().toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig, columnFilters, columns]);

  // Get unique values for column filters
  const getColumnUniqueValues = (column: Column<T>) => {
    // Use custom getFilterValues if provided
    if (column.getFilterValues) {
      return column.getFilterValues(data);
    }
    
    const values = data.map(item => getNestedValue(item, column.key as string))
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(value => value.toString());
    return [...new Set(values)].sort();
  };

  const SortIcon = ({ column, currentSort }: { column: Column<T>, currentSort: typeof sortConfig }) => {
    if (!column.sortable) return null;
    
    const isActive = currentSort?.key === column.key;
    const direction = currentSort?.direction;
    
    return (
      <span className="ml-1 inline-flex flex-col">
        <svg 
          className={`w-3 h-3 ${isActive && direction === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
        <svg 
          className={`w-3 h-3 -mt-1 ${isActive && direction === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
        </svg>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute inset-y-0 right-[15px] left-auto pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          {filteredAndSortedData.length} of {data.length} items
        </div>
      </div>

      {/* Column Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {columns
          .filter(column => column.filterable !== false)
          .map(column => (
            <div key={column.key as string} className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Filter {column.label}
              </label>
              <select
                className="block w-full text-sm border border-gray-300 rounded-md px-3 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={columnFilters[column.key as string] || ''}
                onChange={(e) => handleColumnFilter(column.key as string, e.target.value)}
              >
                <option value="">All {column.label}</option>
                {getColumnUniqueValues(column).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          ))
        }
      </div>

      {/* Clear Filters */}
      {(searchTerm || Object.values(columnFilters).some(v => v)) && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSearchTerm('');
              setColumnFilters({});
              setSortConfig(null);
            }}
            className="backend-no-red text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key as string}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                    }`}
                    onClick={() => column.sortable !== false && handleSort(column.key as string)}
                  >
                    <div className="flex items-center">
                      {column.label}
                      <SortIcon column={column} currentSort={sortConfig} />
                    </div>
                  </th>
                ))}
                {(onEdit || onDelete || onView || customActions) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((item, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <td key={column.key as string} className="px-6 py-4 whitespace-nowrap text-sm">
                        {column.render
                          ? column.render(getNestedValue(item, column.key as string), item)
                          : getNestedValue(item, column.key as string) || '-'
                        }
                      </td>
                    ))}
                    {(onEdit || onDelete || onView || customActions) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {onView && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onView(item);
                              }}
                              className="backend-no-red text-blue-600 hover:text-blue-900"
                            >
                              View
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(item);
                              }}
                              className="backend-no-red text-gray-600 hover:text-gray-900"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item);
                              }}
                              className="backend-no-red text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                          {customActions && customActions(item)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan={columns.length + (onEdit || onDelete || onView || customActions ? 1 : 0)} 
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}