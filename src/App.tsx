import { useState, useEffect } from 'react'
import ChatWidget from './components/ChatWidget'
import AdminDashboard from './components/AdminDashboard'
import { v4 as uuidv4 } from 'uuid'

function App() {
  const [userId, setUserId] = useState<string>('')
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname)

  useEffect(() => {
    let storedUserId = localStorage.getItem('sfhbot-user-id')
    if (!storedUserId) {
      storedUserId = uuidv4()
      localStorage.setItem('sfhbot-user-id', storedUserId)
    }
    setUserId(storedUserId)

    // Simple router - listen for path changes
    const handlePathChange = () => {
      setCurrentPath(window.location.pathname)
    }
    
    window.addEventListener('popstate', handlePathChange)
    return () => window.removeEventListener('popstate', handlePathChange)
  }, [])

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path)
    setCurrentPath(path)
  }

  if (!userId) {
    return (
      <div style={{ 
        backgroundColor: 'white', 
        color: 'black', 
        padding: '20px', 
        fontFamily: 'Arial, sans-serif' 
      }}>
        Loading SFH Bot...
      </div>
    )
  }

  // Simple routing logic
  if (currentPath === '/admin') {
    return <AdminDashboard />
  }

  return (
    <div style={{ 
      backgroundColor: 'white', 
      color: 'black', 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      minHeight: '100vh'
    }}>
      <header style={{ borderBottom: '1px solid #ccc', paddingBottom: '20px', marginBottom: '20px' }}>
        <h1 style={{ color: 'black', margin: '0 0 10px 0' }}>SFH Bot - AI Receptionist</h1>
        <p style={{ color: '#666', margin: '0 0 15px 0' }}>Ask me anything about our non-profit organization!</p>
        <nav>
          <button 
            onClick={() => navigateTo('/admin')} 
            style={{
              marginLeft: '1rem', 
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Admin Dashboard
          </button>
        </nav>
      </header>
      <main>
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <ChatWidget userId={userId} />
        </div>
      </main>
    </div>
  )
}

export default App