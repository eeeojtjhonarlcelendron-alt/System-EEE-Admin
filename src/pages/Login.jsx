import { useState } from 'react'
import { Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { signIn } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Full-screen background image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/LOGO.jpeg" 
          alt="Background" 
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Sign in form on right side */}
      <div className="relative z-10 w-full max-w-md ml-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-elevated w-full p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Admin Login</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-transparent focus:bg-white outline-none transition-all duration-200 hover:border-gray-300 text-black"
                    placeholder="Enter email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-transparent focus:bg-white outline-none transition-all duration-200 hover:border-gray-300 text-black"
                    placeholder="Enter password"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-maroon-600/25 hover:shadow-xl hover:shadow-maroon-600/30 hover:-translate-y-0.5"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
