<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'
import '@/utils/robotoFont'

const { mobile } = useDisplay()

const drawer = ref(true) // open / close
const rail = ref(false)  // compact mode (desktop only)

const { logout } = useAuth()
const router = useRouter()

const handleLogout = async () => {
  await logout()
  router.push('/login')
}

// desktop = rail toggle | mobile = drawer toggle
const toggleSidebar = () => {
  if (mobile.value) {
    drawer.value = !drawer.value
  } else {
    rail.value = !rail.value
  }
}

// when switching to mobile, reset rail
watch(mobile, (isMobile) => {
  if (isMobile) {
    rail.value = false
    drawer.value = false
  } else {
    drawer.value = true
  }
})
</script>

<template>
  <v-layout class="h-screen">
    <!-- 🟣 SIDEBAR -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="!mobile && rail"
      :permanent="!mobile"
      :temporary="mobile"
      width="260"
      rail-width="72"
      class="bg-grey-darken-3"
    >
      <!-- Logo -->
      <v-list-item class="px-4 py-3">
        <template #prepend>
          <v-icon size="28">mdi-store</v-icon>
        </template>

        <v-list-item-title v-if="!rail" class="text-h6 font-weight-bold">
          QwixKart
        </v-list-item-title>

        <template #append>
          <v-btn
            v-if="!mobile"
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            @click.stop="toggleSidebar"
          />
        </template>
      </v-list-item>

      <v-divider />

      <!-- Nav -->
       <v-app-bar-nav-icon @click="toggleSidebar" />
      <v-list nav density="compact">
        <v-list-item to="/dashboard" prepend-icon="mdi-view-dashboard" title="Dashboard" />
        <v-list-item to="/products" prepend-icon="mdi-package-variant" title="Products" />
        <v-list-item to="/orders" prepend-icon="mdi-receipt-text" title="Orders" />
        <v-list-item to="/payments" prepend-icon="mdi-credit-card" title="Payments" />
        <v-list-item to="/adminnotifications" prepend-icon="mdi-email" title="Messages" />
        <v-list-item to="/adminsupport" prepend-icon="mdi-help-circle" title="Support" />
        <v-list-item to="/users" prepend-icon="mdi-account-group" title="Users" />
        <v-list-item to="/banners" prepend-icon="mdi-image-multiple" title="Banners" />
      </v-list>

      <v-spacer />

      <v-divider />

      <v-list>
        <v-list-item prepend-icon="mdi-logout" title="Logout" @click="handleLogout" />
      </v-list>
    </v-navigation-drawer>

    <!-- 🟢 MAIN CONTENT (NO OVERLAP EVER) -->
    <v-main class="bg-grey-darken-4">
      <v-container fluid class="pa-6">
        <router-view />
      </v-container>
    </v-main>
  </v-layout>
</template>
