import React from 'react'
import {
  HiChartBar,
  HiTemplate,
  HiCog,
  HiBeaker,
  HiTrendingUp,
  HiSparkles,
  HiLogout,
  HiSupport,
  HiHome,
  HiCollection,
  HiAdjustments
} from 'react-icons/hi'

interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

interface NavigationGroup {
  title: string
  items: NavigationItem[]
}

interface ModernSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navigationGroups: NavigationGroup[] = [
  {
    title: 'Overview',
    items: [
      { 
        id: 'dashboard', 
        label: 'Performance Dashboard', 
        icon: HiChartBar
      }
    ]
  },
  {
    title: 'Management',
    items: [
      { 
        id: 'prompts', 
        label: 'System Prompts', 
        icon: HiTemplate
      },
      { 
        id: 'testing', 
        label: 'A/B Testing', 
        icon: HiBeaker,
        badge: 'Beta'
      }
    ]
  },
  {
    title: 'Configuration',
    items: [
      { 
        id: 'settings', 
        label: 'Settings', 
        icon: HiCog
      },
      { 
        id: 'analytics', 
        label: 'Analytics', 
        icon: HiTrendingUp
      }
    ]
  }
]

export default function ModernSidebar({ activeTab, onTabChange }: ModernSidebarProps) {
  return (
    <div className="w-72 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      {/* Logo Section - Preline Style */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <HiSparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-gray-900">SFH Admin</span>
          <span className="text-xs text-gray-500">AI Management Suite</span>
        </div>
      </div>

      {/* Navigation - Preline Hierarchical Style */}
      <nav className="flex-1 px-6 py-6">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={groupIndex > 0 ? 'mt-8' : ''}>
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group.title}
              </h3>
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeTab === item.id
                const Icon = item.icon
                
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onTabChange(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-gray-100 text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }
                      `}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-gray-700' : 'text-gray-400'}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Status Indicator - Preline Style */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">All systems operational</p>
            <p className="text-xs text-green-600 truncate">Last checked: Just now</p>
          </div>
        </div>
      </div>

      {/* Footer - Preline Style */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
            <HiSupport className="h-4 w-4" />
            <span>Support</span>
          </button>
          <button 
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
            title="Sign out"
          >
            <HiLogout className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}