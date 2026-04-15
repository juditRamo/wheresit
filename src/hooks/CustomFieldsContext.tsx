import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useCustomFields } from './useCustomFields'

type CustomFieldsContextValue = ReturnType<typeof useCustomFields>

const CustomFieldsContext = createContext<CustomFieldsContextValue | null>(null)

export function CustomFieldsProvider({ householdId, children }: { householdId: string; children: ReactNode }) {
  const cf = useCustomFields(householdId)
  const value = useMemo(() => cf, [ // eslint-disable-line react-hooks/exhaustive-deps
    cf.fields, cf.values, cf.valuesByEntry, cf.optionLabelMap,
    cf.getEntryValues, cf.saveEntryValues, cf.saveFormValues,
    cf.createField, cf.updateField, cf.deleteField, cf.reorderFields,
    cf.createOption, cf.updateOption, cf.deleteOption,
    cf.loading, cf.refetch,
  ])
  return <CustomFieldsContext.Provider value={value}>{children}</CustomFieldsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomFieldsContext(): CustomFieldsContextValue {
  const ctx = useContext(CustomFieldsContext)
  if (!ctx) throw new Error('useCustomFieldsContext must be used within CustomFieldsProvider')
  return ctx
}
