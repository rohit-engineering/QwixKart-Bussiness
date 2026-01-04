import { ref } from 'vue'
import { supabase } from './useSupabase'

const user = ref<any>(null)
const loading = ref(false)

export function useAuth() {
  const getSession = async () => {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    return user.value
  }

  const login = async (email: string, password: string) => {
    loading.value = true
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    loading.value = false
    if (error) throw error
  }

  const logout = async () => {
    await supabase.auth.signOut()
    user.value = null
  }

  return {
    user,
    loading,
    login,
    logout,
    getSession,
  }
}
