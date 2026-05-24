import type { ReactNode } from 'react'

export type FieldType =
  | 'text' | 'textarea' | 'email' | 'password' | 'number'
  | 'date' | 'time' | 'datetime-local'
  | 'select' | 'multi-select'
  | 'checkbox' | 'radio'
  | 'file' | 'hidden'
  | 'divider' | 'heading'   // layout-only

export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}

export type Validator = (value: unknown, values: Record<string, unknown>) => string | null

export interface FieldDef {
  key: string
  label?: string
  type: FieldType
  required?: boolean
  disabled?: boolean
  placeholder?: string
  hint?: string
  defaultValue?: unknown

  // Select / radio options — static or async
  options?: Array<SelectOption | string>
  loadOptions?: (search: string) => Promise<SelectOption[]>

  // Validation
  validators?: Validator[]
  min?: number | string
  max?: number | string
  minLength?: number
  maxLength?: number
  pattern?: RegExp

  // File
  accept?: string
  multiple?: boolean
  maxSizeMb?: number

  // Conditional visibility
  showWhen?: (values: Record<string, unknown>) => boolean

  // Layout
  colSpan?: 1 | 2 | 3   // within a 3-column grid
  className?: string
  labelSuffix?: ReactNode  // rendered after label

  // For divider/heading types
  text?: string
}

export interface FormSection {
  title?: string
  description?: string
  fields: FieldDef[]
}

export interface GenericFormProps {
  // Schema
  fields?: FieldDef[]
  sections?: FormSection[]

  // Values (controlled)
  values?: Record<string, unknown>
  initialValues?: object
  onChange?: (values: Record<string, unknown>) => void

  // Errors (controlled — or managed internally)
  errors?: Record<string, string>
  onErrorsChange?: (errors: Record<string, string>) => void

  // Submission
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>
  submitLabel?: string
  loading?: boolean

  // Layout
  columns?: 1 | 2 | 3
  className?: string

  // Cancel
  onCancel?: () => void
  cancelLabel?: string

  // Render without form tag (use inside another form or modal)
  formId?: string
  noSubmitButton?: boolean
}
