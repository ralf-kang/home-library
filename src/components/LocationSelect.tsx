export interface LocationOption {
  id: string
  label: string
}

/** 칸(SHELF) 목록 드롭다운. 서버에서 만든 옵션을 받아 그린다. */
export default function LocationSelect({
  name,
  options,
  defaultValue,
  emptyLabel = '위치 미지정',
  required,
}: {
  name: string
  options: LocationOption[]
  defaultValue?: string | null
  emptyLabel?: string
  required?: boolean
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ''} className="input" required={required}>
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
