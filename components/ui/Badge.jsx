const colorMap = {
  blue:   'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  teal:   'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  green:  'bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-300',
  red:    'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-300',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  gray:   'bg-gray-100   dark:bg-gray-700      text-gray-600   dark:text-gray-300',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
}

export function Badge({ label, color = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[color] ?? colorMap.gray} ${className}`}>
      {label}
    </span>
  )
}
