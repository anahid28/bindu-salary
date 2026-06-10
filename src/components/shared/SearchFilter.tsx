'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Search, X, ArrowUpDown, Download, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Branch } from '@/types'

export type SortOption = {
  label: string
  value: string
}

type SearchFilterProps = {
  /** Debounced search value */
  search: string
  onSearchChange: (value: string) => void

  /** Branch filter */
  branches?: Branch[]
  branchFilter?: string
  onBranchChange?: (value: string) => void
  showBranchFilter?: boolean

  /** Status filter tabs */
  statusOptions?: { label: string; value: string; count: number }[]
  statusFilter?: string
  onStatusChange?: (value: string) => void

  /** Sort */
  sortOptions?: SortOption[]
  sortValue?: string
  onSortChange?: (value: string) => void

  /** Result count */
  resultCount?: number
  resultLabel?: string

  /** Extra actions slot */
  actions?: ReactNode

  /** Export CSV */
  onExportCSV?: () => void
  exportLabel?: string

  /** Placeholder for search input */
  searchPlaceholder?: string
}

export function SearchFilter({
  search,
  onSearchChange,
  branches,
  branchFilter,
  onBranchChange,
  showBranchFilter = false,
  statusOptions,
  statusFilter,
  onStatusChange,
  sortOptions,
  sortValue,
  onSortChange,
  resultCount,
  resultLabel = 'results',
  actions,
  onExportCSV,
  exportLabel = 'Export CSV',
  searchPlaceholder = 'Search...',
}: SearchFilterProps) {
  const [localSearch, setLocalSearch] = useState(search)

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, search, onSearchChange])

  // Sync external changes
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      {statusOptions && statusOptions.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onStatusChange?.(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === opt.value
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
              <span className={`ml-1.5 ${statusFilter === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>
                {opt.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters row */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-8 h-9 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(''); onSearchChange('') }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Branch filter */}
        {showBranchFilter && branches && onBranchChange && (
          <Select value={branchFilter ?? 'all'} onValueChange={v => onBranchChange(v ?? 'all')}>
            <SelectTrigger className="w-full sm:w-48 h-9 bg-white border-gray-300 text-gray-900">
              <Filter size={13} className="mr-1.5 text-gray-400 shrink-0" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Sort */}
        {sortOptions && sortOptions.length > 0 && (
          <Select value={sortValue ?? ''} onValueChange={v => onSortChange?.(v ?? '')}>
            <SelectTrigger className="w-full sm:w-44 h-9 bg-white border-gray-300 text-gray-900">
              <ArrowUpDown size={13} className="mr-1.5 text-gray-400 shrink-0" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Actions slot */}
        {actions}

        {/* CSV Export */}
        {onExportCSV && (
          <Button variant="outline" size="sm" onClick={onExportCSV} className="gap-1.5 h-9 text-xs shrink-0 bg-white border-gray-300 text-gray-900 hover:bg-gray-50">
            <Download size={13} />
            <span className="hidden sm:inline">{exportLabel}</span>
          </Button>
        )}

        {/* Result count */}
        {resultCount !== undefined && (
          <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">
            {resultCount} {resultLabel}
          </span>
        )}
      </div>
    </div>
  )
}
