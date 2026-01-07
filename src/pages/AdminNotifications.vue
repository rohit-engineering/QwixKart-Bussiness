<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { supabase } from '@/composables/useSupabase'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { notificationTemplates } from '@/constants/notificationTemplates'

dayjs.extend(relativeTime)

/* ================= ROUTES ================= */
const routeOptions = [
  { title: 'Home', value: '/' },
  { title: 'Shop', value: '/shop' },
  { title: 'Orders', value: '/orders' },
  { title: 'Profile', value: '/profile' },
  { title: 'Cart', value: '/cart' },
  { title: 'Checkout', value: '/checkout' },
  { title: 'Notifications', value: '/notifications' }
]

/* ================= TYPES ================= */
type User = {
  id: string
  username: string | null
  avatar_url: string | null
}

type Notification = {
  id: string
  user_id: string
  category: string
  title: string
  message: string
  created_at: string
  username?: string | null
  avatar_url?: string | null
  metadata?: any
}

/* ================= STATE ================= */
const users = ref<User[]>([])
const notifications = ref<Notification[]>([])
const unreadMap = ref<Record<string, number>>({})

const sendDialog = ref(false)
const broadcastDialog = ref(false)
const selectedUser = ref<User | null>(null)

const orderSearch = ref('')
const filteredUserIdsByOrder = ref<Set<string>>(new Set())

let realtimeChannel: any = null

/* ================= FORM ================= */
const form = ref({
  category: 'system',
  title: '',
  message: '',
  route: '',
  url: '',
  icon: '',
  metadata: {}
})

/* ================= FETCH USERS ================= */
const fetchUsers = async () => {
  const { data } = await supabase.from('public_profiles').select('*')
  users.value = data || []
}

/* ================= FETCH NOTIFICATIONS ================= */
const fetchNotifications = async () => {
  const { data } = await supabase
    .from('notifications_with_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80)

  notifications.value = data || []
}

/* ================= UNREAD MAP ================= */
const fetchUnreadCounts = async () => {
  const { data } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('is_read', false)

  const map: Record<string, number> = {}
  data?.forEach(n => (map[n.user_id] = (map[n.user_id] || 0) + 1))
  unreadMap.value = map
}

/* ================= ORDER SEARCH ================= */
watch(orderSearch, async (val) => {
  if (!val || val.length < 3) {
    filteredUserIdsByOrder.value.clear()
    return
  }

  const { data } = await supabase
    .from('orders')
    .select('user_id')
    .ilike('order_ref', `%${val}%`)
    .limit(5)

  filteredUserIdsByOrder.value = new Set(data?.map(o => o.user_id))
})

/* ================= SORT USERS ================= */
const sortedUsers = computed(() => {
  return [...users.value].sort((a, b) => {
    const aMatch = filteredUserIdsByOrder.value.has(a.id) ? 1 : 0
    const bMatch = filteredUserIdsByOrder.value.has(b.id) ? 1 : 0
    if (aMatch !== bMatch) return bMatch - aMatch

    return (unreadMap.value[b.id] || 0) - (unreadMap.value[a.id] || 0)
  })
})

/* ================= APPLY TEMPLATE ================= */
const applyTemplate = (tpl: any) => {
  form.value = {
    category: tpl.category,
    title: tpl.title,
    message: tpl.message,
    route: tpl.route || '',
    url: tpl.url || '',
    icon: tpl.icon || '',
    metadata: tpl.metadata || {}
  }
}

/* ================= SEND ================= */
const sendNotification = async (userId?: string) => {
  const targets = userId ? [userId] : users.value.map(u => u.id)

  for (const id of targets) {
    await supabase.rpc('admin_send_notification', {
      p_user_id: id,
      p_category: form.value.category,
      p_title: form.value.title,
      p_message: form.value.message,
      p_route: form.value.route,
      p_url: form.value.url,
      p_icon: form.value.icon,
      p_metadata: form.value.metadata
    })
  }

  sendDialog.value = false
  broadcastDialog.value = false
}

/* ================= SOFT DELETE ================= */
const markRead = async (id: string) => {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  notifications.value = notifications.value.filter(n => n.id !== id)
}

/* ================= ACTIVE USERS ================= */
const activeUsers = computed(
  () =>
    new Set(
      notifications.value
        .filter(n => ['order', 'payment'].includes(n.category))
        .map(n => n.user_id)
    )
)

/* ================= LIVE MARQUEE ================= */
const marqueeText = computed(() =>
  notifications.value.slice(0, 5).map(n => {
    if (n.category === 'order')
      return `🛒 Order received from ${n.username || 'User'}`
    if (n.category === 'payment')
      return `💸 Payment received for ${n.username || 'User'}`
    return `🔔 ${n.title}`
  }).join('   •   ')
)

/* ================= DIALOG ================= */
const dialogOpen = computed({
  get: () => sendDialog.value || broadcastDialog.value,
  set: v => {
    if (!v) {
      sendDialog.value = false
      broadcastDialog.value = false
    }
  }
})

/* ================= REALTIME ================= */
const initRealtime = () => {
  realtimeChannel = supabase
    .channel('admin-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      async payload => {
        const { data } = await supabase
          .from('notifications_with_profiles')
          .select('*')
          .eq('id', payload.new.id)
          .single()

        if (data) {
          notifications.value.unshift(data)
          fetchUnreadCounts()
        }
      }
    )
    .subscribe()
}

onMounted(async () => {
  await fetchUsers()
  await fetchNotifications()
  await fetchUnreadCounts()
  initRealtime()
})

onBeforeUnmount(() => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
})
</script>

<template>
  <v-container fluid>

    <!-- 🔴 LIVE MARQUEE -->
    <v-alert type="info" variant="tonal" class="mb-3">
      <marquee behavior="scroll" direction="left">
        {{ marqueeText }}
      </marquee>
    </v-alert>

    <!-- HEADER -->
    <div class="d-flex justify-space-between mb-3 align-center">
      <h2>🔔 Admin Notification Center</h2>
      <v-btn color="primary" @click="broadcastDialog = true">Broadcast</v-btn>
    </div>

    <!-- 🔍 ORDER SEARCH -->
    <v-text-field
      v-model="orderSearch"
      label="Search by Order ID"
      prepend-inner-icon="mdi-magnify"
      class="mb-4"
      clearable
    />

    <v-row>
      <!-- USERS -->
      <v-col cols="12" md="3">
        <v-card class="rounded-xl" height="75vh">
          <v-card-title>Users</v-card-title>
          <v-divider />
          <v-list density="compact" style="overflow-y:auto; max-height:68vh">
            <v-list-item
              v-for="u in sortedUsers"
              :key="u.id"
              @click="selectedUser = u; sendDialog = true"
            >
              <template #prepend>
                <v-badge v-if="activeUsers.has(u.id)" dot color="red">
                  <v-avatar size="32">
                    <v-img v-if="u.avatar_url" :src="u.avatar_url" />
                    <v-icon v-else>mdi-account</v-icon>
                  </v-avatar>
                </v-badge>
              </template>
              <v-list-item-title>{{ u.username || 'User' }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- LIVE FEED -->
      <v-col cols="12" md="9">
        <v-card class="rounded-xl" height="75vh">
          <v-card-title>Live Activity</v-card-title>
          <v-divider />
          <v-list style="overflow-y:auto; max-height:68vh">
            <v-list-item v-for="n in notifications" :key="n.id">
              <template #prepend>
                <v-avatar size="32">
                  <v-img v-if="n.avatar_url" :src="n.avatar_url" />
                  <v-icon v-else>mdi-account</v-icon>
                </v-avatar>
              </template>

              <v-list-item-title>
                {{ n.title }}
                <v-chip size="x-small" class="ml-2">{{ n.category }}</v-chip>
              </v-list-item-title>

              <v-list-item-subtitle>
                {{ n.message }}
                <div class="text-caption">
                  {{ dayjs(n.created_at).fromNow() }}
                </div>
              </v-list-item-subtitle>

              <template #append>
                <v-btn
                  icon="mdi-delete-outline"
                  variant="text"
                  color="red"
                  @click="markRead(n.id)"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <!-- FORM -->
    <v-dialog v-model="dialogOpen" max-width="540">
      <v-card>
        <v-card-title>Compose Notification</v-card-title>

        <v-card-text>
          <v-select
            label="Template"
            :items="notificationTemplates"
            item-title="name"
            return-object
            @update:modelValue="applyTemplate"
          />

          <v-select
            v-model="form.category"
            :items="['order','payment','promotion','system']"
            label="Category"
          />

          <v-text-field v-model="form.title" label="Title" />
          <v-textarea v-model="form.message" label="Message" />

          <v-select
            v-model="form.route"
            :items="routeOptions"
            item-title="title"
            item-value="value"
            label="Internal Route"
            clearable
          />

          <v-text-field
            v-model="form.url"
            label="External URL"
            placeholder="https://example.com"
          />

          <v-text-field v-model="form.icon" label="Icon class" />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" @click="sendNotification(selectedUser?.id)">
            Send
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>