import React from 'react'
import {
  HiChevronRight,
  HiExternalLink
} from 'react-icons/hi'

interface ConfigurationCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  actions?: React.ReactNode
  headerAction?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'outline'
  }
  collapsible?: boolean
  defaultExpanded?: boolean
  className?: string
}

export default function ConfigurationCard({
  title,
  description,
  icon: Icon,
  children,
  actions,
  headerAction,
  collapsible = false,
  defaultExpanded = true,
  className = ''
}: ConfigurationCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)

  const buttonVariants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
    outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                <Icon className="h-6 w-6 text-gray-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {headerAction && (
              <button
                onClick={headerAction.onClick}
                className={`
                  inline-flex items-center px-4 py-2 border rounded-lg shadow-sm text-sm font-medium focus:outline-none transition-colors
                  ${buttonVariants[headerAction.variant || 'primary']}
                `}
              >
                {headerAction.label}
                <HiExternalLink className="ml-2 -mr-1 h-4 w-4" />
              </button>
            )}
            
            {collapsible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-colors"
              >
                <HiChevronRight 
                  className={`h-5 w-5 transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : ''
                  }`} 
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {(!collapsible || isExpanded) && (
        <div className="px-6 py-6">
          {children}
        </div>
      )}

      {/* Actions */}
      {actions && (!collapsible || isExpanded) && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          {actions}
        </div>
      )}
    </div>
  )
}

// Subcomponents for common configuration patterns
export function ConfigSection({ 
  title, 
  children, 
  className = '' 
}: { 
  title: string
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div className={`mb-6 last:mb-0 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-900 mb-4">{title}</h4>
      {children}
    </div>
  )
}

export function ConfigRow({ 
  label, 
  description, 
  children, 
  className = '' 
}: { 
  label: string
  description?: string
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${className}`}>
      <div className="flex-1 min-w-0 mr-4">
        <label className="text-sm font-medium text-gray-900">{label}</label>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  )
}

export function ConfigToggle({ 
  checked, 
  onChange, 
  disabled = false 
}: { 
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean 
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      role="switch"
      aria-checked={checked}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

export function ConfigSelect({ 
  value, 
  onChange, 
  options, 
  disabled = false 
}: { 
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean 
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function ConfigSlider({ 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  step = 1, 
  disabled = false 
}: { 
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean 
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-right">
        {value}
      </span>
    </div>
  )
}