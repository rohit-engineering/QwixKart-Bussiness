<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()
const { login, loading } = useAuth()

const submit = async () => {
  error.value = ''
  try {
    await login(email.value, password.value)
    router.push('/dashboard')
  } catch (err: any) {
    error.value = err.message
  }
}
</script>

<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <v-card width="420">
      <v-card-title>Admin Login</v-card-title>

      <v-card-text>
        <v-text-field label="Email" v-model="email" />
        <v-text-field label="Password" type="password" v-model="password" />

        <v-alert v-if="error" type="error" class="mt-2">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-btn block :loading="loading" @click="submit">
          Login
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>
