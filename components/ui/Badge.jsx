const colorMap = {
  blue:   'bg-primary-100 text-primary-700',
  teal:   'bg-primary-100 text-primary-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  gray:   'bg-gray-100 text-gray-600',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
}

export function Badge({ label, color = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[color] ?? colorMap.gray} ${className}`}>
      {label}
    </span>
  )
}
