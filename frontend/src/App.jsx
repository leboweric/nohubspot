import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import ContactsList from './components/ContactsList'
import ContactDetail from './components/ContactDetail'
import { isAuthenticated, logout } from './lib/auth'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated()
      setIsLoggedIn(authenticated)
      setLoading(false)
    }
    checkAuth()
  }, [])

  const handleLogin = () => {
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    logout()
    setIsLoggedIn(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="App">
        {isLoggedIn && (
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900">NotHubSpot</h1>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </nav>
        )}

        <Routes>
          <Route 
            path="/login" 
            element={
              isLoggedIn ? 
                <Navigate to="/contacts" replace /> : 
                <Login onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/contacts" 
            element={
              isLoggedIn ? 
                <ContactsList /> : 
                <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/contacts/:id" 
            element={
              isLoggedIn ? 
                <ContactDetail /> : 
                <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/" 
            element={
              <Navigate to={isLoggedIn ? "/contacts" : "/login"} replace />
            } 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
