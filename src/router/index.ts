import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/composables/useSupabase'

const routes = [
  {
    path: '/login',
    component: () => import('@/pages/Login.vue'),
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },

      { path: 'dashboard', component: () => import('@/pages/Dashboard.vue') },

      { path: 'products', component: () => import('@/pages/Products.vue') },

      // ✅ FIX: VARIANTS ROUTE MOVED INSIDE
      {
        path: 'products/:id/variants',
        name: 'ProductVariants',
        component: () => import('@/pages/ProductVariants.vue'),
        props: true,
      },

      { path: 'orders', component: () => import('@/pages/Orders.vue') },
      { path: 'payments', component: () => import('@/pages/Payments.vue') },
      { path: 'users', component: () => import('@/pages/Users.vue') },
      { path: 'banners', component: () => import('@/pages/Banners.vue') },
      { path: 'adminnotifications', component: () => import('@/pages/AdminNotifications.vue') },
      { path: 'adminsupport' , component: () => import('@/pages/AdminSupport.vue') }
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/* ================= AUTH GUARD ================= */
router.beforeEach(async (to) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && to.path !== '/login') {
    return '/login'
  }

  if (session) {
    const role = session.user.app_metadata?.role

    if (role !== 'admin') {
      await supabase.auth.signOut()
      return '/login'
    }

    if (to.path === '/login') {
      return '/dashboard'
    }
  }
})

export default router
