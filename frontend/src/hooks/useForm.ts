/**
 * useForm — SOW §6.4.10
 * Generic form state management hook with validation.
 */
import { useState, useCallback } from 'react'

type Values = Record<string, unknown>
type Errors = Record<string, string>
type Validator = (value: unknown, values: Values) => string | null
type Rules = Record<string, Validator[]>

export interface UseFormReturn<T extends Values> {
  values: T
  errors: Errors
  touched: Record<string, boolean>
  isDirty: boolean
  isValid: boolean
  isSubmitting: boolean

  setValue: (key: keyof T, value: unknown) => void
  setValues: (partial: Partial<T>) => void
  setError: (key: keyof T, error: string) => void
  setErrors: (errors: Errors) => void
  touch: (key: keyof T) => void
  touchAll: () => void
  reset: (newValues?: Partial<T>) => void

  validate: () => boolean
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => (e?: React.FormEvent) => Promise<void>
  getFieldProps: (key: keyof T) => {
    value: unknown
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
    onBlur: () => void
    error: string | undefined
  }
}

export function useForm<T extends Values>(
  initialValues: T,
  rules: Rules = {},
): UseFormReturn<T> {
  const [values, setAllValues] = useState<T>(initialValues)
  const [errors, setAllErrors] = useState<Errors>({})
  const [touched, setAllTouched] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues)

  const validateField = useCallback((key: string, val: unknown, allVals: T): string | null => {
    const validators = rules[key] ?? []
    for (const v of validators) {
      const err = v(val, allVals)
      if (err) return err
    }
    return null
  }, [rules])

  const validate = useCallback((): boolean => {
    const errs: Errors = {}
    for (const key of Object.keys(rules)) {
      const err = validateField(key, values[key], values)
      if (err) errs[key] = err
    }
    setAllErrors(errs)
    return Object.keys(errs).length === 0
  }, [values, validateField, rules])

  const setValue = useCallback((key: keyof T, value: unknown) => {
    setAllValues((prev) => {
      const next = { ...prev, [key]: value }
      const err = validateField(String(key), value, next)
      setAllErrors((e) => {
        if (err) return { ...e, [key]: err }
        const n = { ...e }; delete n[String(key)]; return n
      })
      return next
    })
  }, [validateField])

  const setValues = useCallback((partial: Partial<T>) => {
    setAllValues((prev) => ({ ...prev, ...partial }))
  }, [])

  const setError = useCallback((key: keyof T, error: string) => {
    setAllErrors((e) => ({ ...e, [String(key)]: error }))
  }, [])

  const touch = useCallback((key: keyof T) => {
    setAllTouched((t) => ({ ...t, [String(key)]: true }))
  }, [])

  const touchAll = useCallback(() => {
    const t: Record<string, boolean> = {}
    for (const k of Object.keys(rules)) t[k] = true
    setAllTouched(t)
  }, [rules])

  const reset = useCallback((newValues?: Partial<T>) => {
    setAllValues({ ...initialValues, ...newValues } as T)
    setAllErrors({})
    setAllTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  const handleSubmit = useCallback(
    (onSubmit: (vals: T) => void | Promise<void>) =>
      async (e?: React.FormEvent) => {
        e?.preventDefault()
        touchAll()
        if (!validate()) return
        setIsSubmitting(true)
        try { await onSubmit(values) } finally { setIsSubmitting(false) }
      },
    [values, validate, touchAll]
  )

  const getFieldProps = useCallback((key: keyof T) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
      setValue(key, v)
    },
    onBlur: () => touch(key),
    error: touched[String(key)] ? errors[String(key)] : undefined,
  }), [values, errors, touched, setValue, touch])

  const isValid = Object.keys(errors).length === 0

  return {
    values, errors, touched, isDirty, isValid, isSubmitting,
    setValue, setValues, setError, setErrors: setAllErrors,
    touch, touchAll, reset, validate, handleSubmit, getFieldProps,
  }
}
