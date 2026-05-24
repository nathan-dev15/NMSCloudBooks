export type FilterOperator =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'between'
  | 'in' | 'not_in'
  | 'is_empty' | 'is_not_empty'
  | 'date_range'

export type FilterFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'multi_select'
export type FilterLogic = 'AND' | 'OR'

export interface FilterField {
  key: string
  label: string
  type: FilterFieldType
  operators?: FilterOperator[]     // override defaults per type
  options?: Array<{ label: string; value: string } | string>   // for select/multi_select
  placeholder?: string
}

export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string | string[] | [string, string] | boolean | null
}

export interface FilterPreset {
  id: string
  name: string
  conditions: FilterCondition[]
  logic: FilterLogic
}

export interface ActiveFilters {
  conditions: FilterCondition[]
  logic: FilterLogic
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals:       'equals',
  not_equals:   'does not equal',
  contains:     'contains',
  not_contains: 'does not contain',
  starts_with:  'starts with',
  ends_with:    'ends with',
  gt:           'greater than',
  gte:          'greater than or equal',
  lt:           'less than',
  lte:          'less than or equal',
  between:      'is between',
  in:           'is any of',
  not_in:       'is none of',
  is_empty:     'is empty',
  is_not_empty: 'is not empty',
  date_range:   'date range',
}

export const DEFAULT_OPERATORS: Record<FilterFieldType, FilterOperator[]> = {
  text:         ['contains', 'equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  number:       ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty'],
  date:         ['equals', 'gt', 'gte', 'lt', 'lte', 'date_range', 'is_empty'],
  select:       ['equals', 'not_equals', 'in', 'is_empty'],
  boolean:      ['equals'],
  multi_select: ['in', 'not_in'],
}
