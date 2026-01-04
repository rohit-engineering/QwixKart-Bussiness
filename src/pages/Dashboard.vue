<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/composables/useSupabase'

const loading = ref(true)

const overview = ref({
  total_orders: 0,
  shipped_orders: 0,
  upi_orders: 0,
  cod_orders: 0,
  revenue: 0,
  today_orders: 0,
  business_status: 'stable'
})

onMounted(async () => {
  const { data, error } = await supabase.rpc('admin_business_overview')
  if (!error && data) overview.value = data
  loading.value = false
})

/* Business Day Calculation */
const businessStart = new Date('2025-12-19')

const businessDay = computed(() => {
  const diff =
    (Date.now() - businessStart.getTime()) /
    (1000 * 60 * 60 * 24)
  return Math.floor(diff) + 1
})

const businessStatusColor = computed(() => {
  return overview.value.business_status === 'growth'
    ? 'green'
    : overview.value.business_status === 'loss'
    ? 'red'
    : 'grey'
})
</script>
<template>
  <div>
    <h2 class="mb-4 font-weight-bold">Business Overview</h2>

    <!-- KPI GRID -->
    <v-row>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Total Orders</v-card-title>
          <v-card-text class="text-h4">{{ overview.total_orders }}</v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>Orders Shipped</v-card-title>
          <v-card-text class="text-h4">{{ overview.shipped_orders }}</v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>UPI Orders</v-card-title>
          <v-card-text class="text-h4">{{ overview.upi_orders }}</v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-title>COD Orders</v-card-title>
          <v-card-text class="text-h4">{{ overview.cod_orders }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- REVENUE + STATUS -->
    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Total Revenue</v-card-title>
          <v-card-text class="text-h4">
            ₹ {{ overview.revenue }}
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Business Status</v-card-title>
          <v-card-text>
            <v-chip :color="businessStatusColor" size="large">
              {{ overview.business_status.toUpperCase() }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- NOTIFICATIONS -->
    <v-card class="mt-6">
      <v-card-title>Notifications</v-card-title>
      <v-card-text>
        📦 Today: {{ overview.today_orders }} new orders received
      </v-card-text>
    </v-card>

    <!-- BUSINESS DAY -->
    <v-card class="mt-4">
      <v-card-text>
        🗓 Business Day: {{ businessDay }}  
        (Started Monday, 19 Dec 2025)
      </v-card-text>
    </v-card>
  </div>
</template>
