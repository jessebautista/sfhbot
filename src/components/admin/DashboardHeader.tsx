import React, { useState } from 'react'
import {
  HiSearch,
  HiBell,
  HiChevronRight,
  HiHome,
  HiUser,
  HiMenu,
  HiSun,
  HiMoon,
  HiChevronDown
} from 'react-icons/hi'

interface Breadcrumb {
  label: string
  href?: string
}

interface DashboardHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Breadcrumb[]
  actions?: React.ReactNode
}

export default function DashboardHeader({ 
  title, 
  subtitle, 
  breadcrumbs = [] 
}: DashboardHeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left Section - Breadcrumbs */}
          <div className="flex items-center min-w-0 flex-1">
            {/* Mobile menu button */}
            <button
              type="button"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden mr-2"
            >
              <HiMenu className="h-6 w-6" />
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden lg:flex items-center space-x-2 text-sm min-w-0">
              <HiHome className="h-4 w-4 text-gray-400 flex-shrink-0" />
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <HiChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  {crumb.href ? (
                    <a 
                      href={crumb.href} 
                      className="text-gray-500 hover:text-gray-700 transition-colors truncate"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-gray-900 font-medium truncate">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>

            {/* Title for mobile */}
            <div className="lg:hidden">
              <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
            </div>
          </div>

          {/* Center Section - Search */}
          <div className="hidden sm:flex flex-1 justify-center px-6 max-w-md">
            <div className="w-full">
              <label htmlFor="search" className="sr-only">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <HiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="search"
                  name="search"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm"
                  placeholder="Search..."
                  type="search"
                />
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1 lg:gap-2">
            {/* Back to Chat Button */}
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="hidden lg:inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              ← Back to Chat
            </button>

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <HiSun className="h-5 w-5" />
              ) : (
                <HiMoon className="h-5 w-5" />
              )}
            </button>

            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <HiBell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-900 leading-4">Admin User</p>
                  <p className="text-xs text-gray-500 leading-3">admin@sfhbot.org</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <HiUser className="h-5 w-5 text-gray-600" />
                </div>
                <HiChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-1 z-50 border border-gray-200">
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Your Profile</a>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Settings</a>
                  <div className="border-t border-gray-100 my-1"></div>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Sign out</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Title Section - Desktop */}
        <div className="hidden lg:block py-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  )
}