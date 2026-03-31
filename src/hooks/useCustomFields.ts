import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import type { CustomField, CustomFieldOption, CustomFieldValue } from '../types'

export function useCustomFields(householdId: string | null) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [values, setValues] = useState<CustomFieldValue[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(() => {
    if (!householdId) return
    setLoading(true)
    Promise.all([
      supabase
        .from('custom_fields')
        .select('*, custom_field_options(*)')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('custom_field_values')
        .select('*')
        .eq('household_id', householdId),
    ]).then(([fieldsRes, valuesRes]) => {
      setLoading(false)
      const raw = fieldsRes.data ?? []
      // Map embedded options, sort by sort_order
      const mapped: CustomField[] = raw.map((f: Record<string, unknown>) => ({
        ...f,
        options: ((f.custom_field_options as CustomFieldOption[]) ?? [])
          .sort((a, b) => a.sort_order - b.sort_order),
      })) as CustomField[]
      setFields(mapped)
      setValues(valuesRes.data ?? [])
    })
  }, [householdId])

  useEffect(() => {
    if (!householdId) {
      setFields([])
      setValues([])
      return
    }
    refetch()
  }, [householdId, refetch])

  const valuesByEntry = useMemo(() => {
    const map = new Map<string, CustomFieldValue[]>()
    for (const v of values) {
      const list = map.get(v.storage_entry_id)
      if (list) list.push(v)
      else map.set(v.storage_entry_id, [v])
    }
    return map
  }, [values])

  // Map option ID → label for search/display
  const optionLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of fields) {
      for (const opt of f.options) {
        map.set(opt.id, opt.label)
      }
    }
    return map
  }, [fields])

  const getEntryValues = useCallback(
    (entryId: string): Record<string, CustomFieldValue> => {
      const list = valuesByEntry.get(entryId) ?? []
      const map: Record<string, CustomFieldValue> = {}
      for (const v of list) {
        map[v.custom_field_id] = v
      }
      return map
    },
    [valuesByEntry]
  )

  const saveEntryValues = useCallback(
    async (entryId: string, fieldValues: Record<string, { value_text?: string | null; value_number?: number | null; value_boolean?: boolean | null; value_option?: string | null; value_options?: string[] | null; value_date?: string | null }>) => {
      if (!householdId) return
      const existingMap = new Map((valuesByEntry.get(entryId) ?? []).map(v => [v.custom_field_id, v]))

      const upserts: Array<Record<string, unknown>> = []
      const deleteIds: string[] = []

      for (const [fieldId, val] of Object.entries(fieldValues)) {
        const hasValue = val.value_text != null || val.value_number != null || val.value_boolean != null || val.value_option != null || (val.value_options != null && val.value_options.length > 0) || val.value_date != null
        const existing = existingMap.get(fieldId)
        if (hasValue) {
          upserts.push({
            storage_entry_id: entryId,
            custom_field_id: fieldId,
            household_id: householdId,
            value_text: val.value_text ?? null,
            value_number: val.value_number ?? null,
            value_boolean: val.value_boolean ?? null,
            value_option: val.value_option ?? null,
            value_options: val.value_options ?? null,
            value_date: val.value_date ?? null,
          })
        } else if (existing) {
          deleteIds.push(existing.id)
        }
      }

      if (upserts.length > 0) {
        await supabase.from('custom_field_values').upsert(upserts, { onConflict: 'storage_entry_id,custom_field_id' })
      }
      if (deleteIds.length > 0) {
        await supabase.from('custom_field_values').delete().in('id', deleteIds)
      }
      refetch()
    },
    [householdId, valuesByEntry, refetch]
  )

  const createField = useCallback(
    async (field: { name: string; field_type: string }) => {
      if (!householdId) return
      const maxSort = fields.length > 0 ? Math.max(...fields.map(f => f.sort_order)) + 1 : 0
      await supabase.from('custom_fields').insert({
        household_id: householdId,
        name: field.name,
        field_type: field.field_type,
        sort_order: maxSort,
      })
      refetch()
    },
    [householdId, fields, refetch]
  )

  const updateField = useCallback(
    async (id: string, updates: { name?: string; sort_order?: number }) => {
      await supabase.from('custom_fields').update(updates).eq('id', id)
      refetch()
    },
    [refetch]
  )

  const deleteField = useCallback(
    async (id: string) => {
      await supabase.from('custom_fields').delete().eq('id', id)
      refetch()
    },
    [refetch]
  )

  const reorderFields = useCallback(
    async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, i) =>
        supabase.from('custom_fields').update({ sort_order: i }).eq('id', id)
      )
      await Promise.all(updates)
      refetch()
    },
    [refetch]
  )

  // Option CRUD
  const createOption = useCallback(
    async (fieldId: string, label: string): Promise<CustomFieldOption | null> => {
      if (!householdId) return null
      const field = fields.find(f => f.id === fieldId)
      const maxSort = field?.options.length ?? 0
      const { data, error } = await supabase
        .from('custom_field_options')
        .insert({
          custom_field_id: fieldId,
          household_id: householdId,
          label: label.trim(),
          sort_order: maxSort,
        })
        .select()
        .single()
      refetch()
      if (error || !data) return null
      return data as CustomFieldOption
    },
    [householdId, fields, refetch]
  )

  const updateOption = useCallback(
    async (optionId: string, label: string) => {
      await supabase
        .from('custom_field_options')
        .update({ label: label.trim() })
        .eq('id', optionId)
      refetch()
    },
    [refetch]
  )

  const deleteOption = useCallback(
    async (optionId: string) => {
      await supabase.from('custom_field_options').delete().eq('id', optionId)
      refetch()
    },
    [refetch]
  )

  return {
    fields,
    values,
    valuesByEntry,
    optionLabelMap,
    getEntryValues,
    saveEntryValues,
    createField,
    updateField,
    deleteField,
    reorderFields,
    createOption,
    updateOption,
    deleteOption,
    loading,
    refetch,
  }
}
