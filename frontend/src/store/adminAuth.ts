import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminInfo {
  id: number
  username: string
  full_name: string
  role: string
}

interface AdminState {
  token: string | null
  admin: AdminInfo | null
  setAuth: (token: string, admin: AdminInfo) => void
  logout: () => void
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setAuth: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: 'admin-auth-storage' }
  )
)