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
    return <div>Loading...</div>
  }

  // Simple routing logic
  if (currentPath === '/admin') {
    return <AdminDashboard />
  }

  return (
    <div className="App">
      <header className="app-header">
        <h1>SFH Bot - AI Receptionist</h1>
        <p>Ask me anything about our non-profit organization!</p>
        <nav>
          <button onClick={() => navigateTo('/admin')} style={{marginLeft: '1rem', padding: '0.5rem 1rem'}}>
            Admin Dashboard
          </button>
        </nav>
      </header>
      <main>
        <ChatWidget userId={userId} />
      </main>
    </div>
  )
}

export default App