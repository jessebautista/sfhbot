import React from 'react'
import {
  HiArrowUp,
  HiArrowDown,
  HiMinus
} from 'react-icons/hi'

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: string
    type: 'increase' | 'decrease' | 'neutral'
    label?: string
  }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray'
  className?: string
}

const colorClasses = {
  blue: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600'
  },
  green: {
    iconBg: 'bg-green-50',
    iconText: 'text-green-600'
  },
  purple: {
    iconBg: 'bg-purple-50',
    iconText: 'text-purple-600'
  },
  orange: {
    iconBg: 'bg-orange-50',
    iconText: 'text-orange-600'
  },
  red: {
    iconBg: 'bg-red-50',
    iconText: 'text-red-600'
  },
  gray: {
    iconBg: 'bg-gray-50',
    iconText: 'text-gray-600'
  }
}

const trendIcons = {
  increase: HiArrowUp,
  decrease: HiArrowDown,
  neutral: HiMinus
}

const trendColors = {
  increase: 'text-green-600',
  decrease: 'text-red-600',
  neutral: 'text-gray-500'
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
  className = ''
}: StatsCardProps) {
  const colors = colorClasses[color]
  const TrendIcon = trend ? trendIcons[trend.type] : null

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center`}>
              <Icon className={`h-6 w-6 ${colors.iconText}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
          {trend && (
            <div className="text-right">
              <div className={`flex items-center gap-1 text-sm font-semibold ${trendColors[trend.type]}`}>
                {TrendIcon && <TrendIcon className="h-4 w-4" />}
                {trend.value}
              </div>
              {trend.label && (
                <p className="text-xs text-gray-500 mt-1">
                  {trend.label}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}