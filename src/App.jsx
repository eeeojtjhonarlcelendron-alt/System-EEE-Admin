import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Layout from './components/Layout'
import Performance from './pages/Performance'
import Clustering from './pages/Clustering'
import { initializeDataService } from './lib/data'

function AppRoutes() {
  const { user, loading, signOut } = useAuth()

  // Initialize data service once on app load
  useEffect(() => {
    if (user && !loading) {
      console.log('🚀 Initializing data service for authenticated user...')
      initializeDataService().catch(err => {
        console.error('❌ Failed to initialize data service:', err)
      })
    }
  }, [user, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          user ? 
          <Navigate to="/dashboard" replace /> : 
          <Login />
        } 
      />
      <Route 
        path="/" 
        element={
          user ? 
          <Layout onLogout={signOut} /> : 
          <Navigate to="/login" replace />
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="data-management/performance" element={<Performance />} />
        <Route path="data-management/kpi" element={<Navigate to="/dashboard" replace />} />
        <Route path="data-management/rider" element={<Navigate to="/dashboard" replace />} />
        <Route path="data-management/clustering" element={<Clustering />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
