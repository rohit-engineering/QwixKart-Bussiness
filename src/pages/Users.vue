<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/composables/useSupabase'
import dayjs from 'dayjs'

/* ================= TYPES ================= */
type PublicProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  city: string | null
}

type OrderSummary = {
  user_id: string
  total_orders: number
  last_order_at: string | null
}

/* ================= STATE ================= */
const users = ref<PublicProfile[]>([])
const ordersSummary = ref<Record<string, OrderSummary>>({})
const loading = ref(false)

const search = ref('')
const selectedUser = ref<PublicProfile | null>(null)
const userDialog = ref(false)

const userOrders = ref<any[]>([])

/* ================= FETCH USERS ================= */
const fetchUsers = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .order('username')

  if (error) {
    console.error(error)
  }

  users.value = data || []
  loading.value = false
}

/* ================= FETCH ORDER SUMMARY ================= */
const fetchOrderSummary = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('user_id, created_at, order_ref, payment_method')

  if (error) {
    console.error(error)
    return
  }

  const map: Record<string, any> = {}

  data?.forEach(o => {
    if (!map[o.user_id]) {
      map[o.user_id] = {
        total_orders: 1,
        last_order_at: o.created_at,
        last_order_ref: o.order_ref,
        last_payment_method: o.payment_method,
      }
    } else {
      map[o.user_id].total_orders++

      if (o.created_at > map[o.user_id].last_order_at) {
        map[o.user_id].last_order_at = o.created_at
        map[o.user_id].last_order_ref = o.order_ref
        map[o.user_id].last_payment_method = o.payment_method
      }
    }
  })

  ordersSummary.value = map
}

/* ================= FETCH USER ORDERS ================= */
const openUserDetails = async (user: PublicProfile) => {
  selectedUser.value = user
  userDialog.value = true

  const { data, error } = await supabase
    .from('orders')
    .select('id, item, quantity, total_amount, created_at, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) console.error(error)
  userOrders.value = data || []
}

onMounted(async () => {
  await fetchUsers()
  await fetchOrderSummary()
})

/* ================= FILTER ================= */
const filteredUsers = computed(() =>
  users.value.filter(u =>
    u.username?.toLowerCase().includes(search.value.toLowerCase())
  )
)
</script>

<template>
  <div>
    <!-- HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h2>Users</h2>
    </div>

    <!-- SEARCH -->
    <v-card class="mb-4 pa-3">
      <v-text-field
        v-model="search"
        label="Search users"
        prepend-inner-icon="mdi-magnify"
      />
    </v-card>

    <!-- USERS GRID -->
    <v-row dense>
      <v-col
        v-for="user in filteredUsers"
        :key="user.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card class="h-100" @click="openUserDetails(user)">
          <v-card-text class="text-center">
            <v-avatar size="72" class="mb-3">
              <v-img
                v-if="user.avatar_url"
                :src="user.avatar_url"
              ></v-img>
              <v-icon v-else size="48">mdi-account</v-icon>
            </v-avatar>

            <div class="font-weight-medium">
              {{ user.username || 'Unnamed User' }}
            </div>

            <div class="text-caption text-grey">
              {{ user.city || '—' }}
            </div>

            <v-divider class="my-3" />

            <div class="text-caption">
              Orders:
              <strong>
                {{ ordersSummary[user.id]?.total_orders || 0 }}
              </strong>
            </div>

            <div class="text-caption">
              Last order:
              {{ ordersSummary[user.id]?.last_order_at
                ? dayjs(ordersSummary[user.id].last_order_at).format('DD MMM YYYY')
                : '—' }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- USER DETAILS DIALOG -->
    <v-dialog v-model="userDialog" max-width="600">
      <v-card v-if="selectedUser">
        <v-card-title>
          {{ selectedUser.username || 'User Details' }}
        </v-card-title>

        <v-card-text>
          <v-row class="mb-4">
            <v-col cols="12" class="text-center">
            </v-col>

            <v-col cols="12" class="text-center">
              <div class="font-weight-medium">
                {{ selectedUser.username || '—' }}
              </div>
              <div class="text-caption">
                {{ selectedUser.city || '—' }}
              </div>
            </v-col>
          </v-row>

          <v-divider class="mb-3" />

          <h4 class="mb-2">Recent Orders</h4>

          <v-card
  v-for="order in userOrders"
  :key="order.id"
  variant="outlined"
  class="mb-2 pa-2"
>
  <div class="d-flex justify-space-between">
    <div>
      <strong>{{ order.item }}</strong>

      <div class="text-caption">
        Order ID: {{ order.order_ref || order.id }}
      </div>

      <div class="text-caption">
        Payment: {{ order.payment_method || '—' }}
      </div>

      <div class="text-caption">
        Qty: {{ order.quantity }}
      </div>
    </div>

    <div class="text-right">
      ₹ {{ order.total_amount }}
      <div class="text-caption">
        {{ dayjs(order.created_at).format('DD MMM') }}
      </div>
    </div>
  </div>

  <v-chip
    size="x-small"
    class="mt-1"
    :color="
      order.status === 'delivered'
        ? 'green'
        : order.status === 'cancelled'
        ? 'red'
        : 'blue'
    "
  >
    {{ order.status }}
  </v-chip>
</v-card>

          <div v-if="!userOrders.length" class="text-caption">
            No orders yet
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="userDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
