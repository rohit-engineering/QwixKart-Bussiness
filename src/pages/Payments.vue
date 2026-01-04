<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { supabase } from '@/composables/useSupabase'
import dayjs from 'dayjs'

/* ================= TYPES ================= */
type Payment = {
  id: number
  user_id: string
  order_ref: string
  amount: number
  method: string | null
  upi_app: string | null
  status: 'pending_verification' | 'verified' | 'failed'
  entered_upi_id: string | null
  utr: string | null
  verification_mode: string | null
  verification_level: string | null
  created_at: string
}

/* ================= STATE ================= */
const payments = ref<Payment[]>([])
const loading = ref(false)

const search = ref('')
const statusFilter = ref<string | null>(null)

/* ================= FETCH ================= */
const fetchPayments = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
  }

  payments.value = data || []
  loading.value = false
}

onMounted(fetchPayments)

/* ================= REALTIME ================= */
const channel = supabase
  .channel('realtime-payments')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'payments' },
    fetchPayments
  )
  .subscribe()

/* ================= FILTER ================= */
const filteredPayments = computed(() =>
  payments.value.filter(p => {
    const matchSearch =
      p.order_ref.toLowerCase().includes(search.value.toLowerCase()) ||
      p.utr?.toLowerCase().includes(search.value.toLowerCase())

    const matchStatus =
      !statusFilter.value || p.status === statusFilter.value

    return matchSearch && matchStatus
  })
)

/* ================= ACTIONS ================= */
const updatePaymentStatus = async (
  paymentId: number,
  status: 'pending_verification' | 'verified' | 'failed'
) => {
  const { error } = await supabase
    .from('payments')
    .update({
      status,
      verification_level: 'admin',
    })
    .eq('id', paymentId)

  if (error) {
    alert(error.message)
  }
}

/* ================= CLEANUP ================= */
onBeforeUnmount(() => {
  supabase.removeChannel(channel)
})
</script>

<template>
  <div>
    <!-- HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h2>Payments</h2>
    </div>

    <!-- FILTERS -->
    <v-card class="mb-4 pa-3">
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="search"
            label="Search Order Ref / UTR"
            prepend-inner-icon="mdi-magnify"
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-select
            v-model="statusFilter"
            label="Status"
            clearable
            :items="['initiated', 'verified', 'failed']"
          />
        </v-col>
      </v-row>
    </v-card>

    <!-- TABLE -->
    <v-card>
      <v-data-table
        :items="filteredPayments"
        :loading="loading"
      >
        <template #headers>
          <tr>
            <th>ID</th>
            <th>Order</th>
            <th>Amount</th>
            <th>Method</th>
            <th>UPI App</th>
            <th>UPI / UTR</th>
            <th>Status</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </template>

        <template #item="{ item }">
          <tr>
            <td>#{{ item.id }}</td>
            <td>{{ item.order_ref }}</td>
            <td>₹ {{ item.amount }}</td>
            <td>{{ item.method || '—' }}</td>
            <td>
  <v-chip
    v-if="item.upi_app"
    size="small"
    color="blue"
    variant="outlined"
  >
    {{ item.upi_app }}
  </v-chip>
  <span v-else>—</span>
</td>
            <td>
              <div class="text-caption">
                {{ item.entered_upi_id || '—' }}
              </div>
              <div class="font-weight-medium">
                {{ item.utr || '—' }}
              </div>
            </td>

            <td>
              <v-chip
                :color="
                  item.status === 'verified'
                    ? 'green'
                    : item.status === 'failed'
                    ? 'red'
                    : 'orange'
                "
                size="small"
              >
                {{ item.status }}
              </v-chip>
            </td>

            <td>
              {{ dayjs(item.created_at).format('DD MMM YYYY, hh:mm A') }}
            </td>

            <td style="min-width: 180px">
  <v-select
    :model-value="item.status"
    :items="[
      { title: 'Pending Verification', value: 'pending_verification' },
      { title: 'Verified', value: 'verified' },
      { title: 'Failed', value: 'failed' }
    ]"
    density="compact"
    variant="outlined"
    hide-details
    @update:model-value="
      (value) => updatePaymentStatus(item.id, value)
    "
  />
</td>


          </tr>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

