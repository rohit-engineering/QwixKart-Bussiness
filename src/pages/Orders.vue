<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { supabase } from '@/composables/useSupabase'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { registerRobotoFont } from '@/utils/robotoFont'
/* ================= TYPES ================= */
type Order = {
  id: number
  user_id: string
  product_id: number | null
  variant_id: number | null

  item: string
  category: string | null
  quantity: number

  /* ✅ VARIANT SNAPSHOT */
  variant_title: string | null
  variant_color: string | null
  variant_size: string | null
  variant_sku: string | null
  variant_price: number | null
  variant_images: string[] | null

  /* PRICING */
  unit_price: number | null
  line_total: number | null
  total_amount: number

  /* CUSTOMER */
  name: string
  email: string
  phone: string
  address: string
  pincode: string

  /* PAYMENT */
  order_ref: string
  payment_method: string | null
  payment_status: 'pending' | 'paid' | 'failed' | null
  status: string

  /* TIME */
  created_at: string
}

/* ================= EXPORT ================= */
const exportData = computed(() =>
  filteredOrders.value.map(o => ({
    OrderRef: o.order_ref,
    Customer: o.name,
    Phone: o.phone,
    Item: o.item,
    Quantity: o.quantity,
    Amount: o.total_amount,
    PaymentMethod: o.payment_method,
    PaymentStatus: o.payment_status,
    OrderStatus: o.status,
    Date: dayjs(o.created_at).format('DD-MM-YYYY'),
  }))
)

/* ================= STATE ================= */
const orders = ref<Order[]>([])
const loading = ref(false)

const search = ref('')
const statusFilter = ref<string | null>(null)

const selectedOrder = ref<Order | null>(null)
const detailsDrawer = ref(false)

/* ================= FETCH ================= */
const fetchOrders = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) console.error(error)
  orders.value = data || []

  loading.value = false
}

onMounted(fetchOrders)

/* ================= REALTIME ================= */
const channel = supabase
  .channel('realtime-orders')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'orders' },
    fetchOrders
  )
  .subscribe()

/* ================= FILTER ================= */
const filteredOrders = computed(() =>
  orders.value.filter(o => {
    const q = search.value.toLowerCase()

    const matchSearch =
      o.order_ref?.toLowerCase().includes(q) ||
      o.name?.toLowerCase().includes(q) ||
      o.phone?.toLowerCase().includes(q)

    const matchStatus =
      !statusFilter.value || o.status === statusFilter.value

    return matchSearch && matchStatus
  })
)
/* ================= EXPORT FUNCTIONS ================= */
const exportToExcel = () => {
  const worksheet = XLSX.utils.json_to_sheet(exportData.value)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders')

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  })

  const file = new Blob([excelBuffer], {
    type:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  saveAs(file, `orders_${dayjs().format('YYYYMMDD')}.xlsx`)
}

const exportToPDF = () => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  // ✅ register font AFTER doc exists
  registerRobotoFont(doc)

  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)

  doc.text('Orders Report', 40, 30)

  autoTable(doc, {
    startY: 50,
    styles: {
      font: 'Roboto',
      fontSize: 9,
    },
    head: [[
      'Order Ref',
      'Customer',
      'Phone',
      'Item',
      'Qty',
      'Amount',
      'Payment',
      'Status',
      'Date',
    ]],
    body: exportData.value.map(o => [
      o.OrderRef,
      o.Customer,
      o.Phone,
      o.Item,
      o.Quantity,
      `₹ ${o.Amount}`, // ✅ renders correctly
      o.PaymentStatus,
      o.OrderStatus,
      o.Date,
    ]),
  })

  doc.save(`orders_${dayjs().format('YYYYMMDD')}.pdf`)
}


/* ================= ACTIONS ================= */
const openOrder = (order: Order) => {
  selectedOrder.value = order
  detailsDrawer.value = true
}

const updateOrderStatus = async (order: Order, status: string) => {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', order.id)

  if (error) alert(error.message)
}
const allowedTransitions: Record<string, string[]> = {
  processing: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
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
  <h2>Orders</h2>

  <div class="d-flex gap-2">
    <v-btn
      color="green"
      prepend-icon="mdi-file-excel"
      @click="exportToExcel"
    >
      Excel
    </v-btn>

    <v-btn
      color="red"
      prepend-icon="mdi-file-pdf-box"
      @click="exportToPDF"
    >
      PDF
    </v-btn>
  </div>
</div>

    <!-- FILTERS -->
    <v-card class="mb-4 pa-3">
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="search"
            label="Search Order / Customer / Phone"
            prepend-inner-icon="mdi-magnify"
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-select
            v-model="statusFilter"
            label="Order Status"
            clearable
            :items="[
              'processing',
              'confirmed',
              'shipped',
              'delivered',
              'cancelled'
            ]"
          />
        </v-col>
      </v-row>
    </v-card>

    <!-- TABLE -->
    <v-card>
      <v-data-table
        :items="filteredOrders"
        :loading="loading"
      >
           <template #headers>
  <tr>
    <th>View</th>
    <th>Order</th>
    <th>Customer</th>
    <th>Product</th>
    <th>Variant</th>
    <th>Qty</th>
    <th>Amount</th>
    <th>Payment</th>
    <th>Status</th>
    <th>Date</th>
    <th>Action</th>
  </tr>
</template>


        <template #item="{ item }">
  <tr @click="openOrder(item)" style="cursor:pointer">

    <!-- VIEW -->
    <td>
      <v-btn size="x-small" variant="tonal">View</v-btn>
    </td>

    <!-- ORDER -->
    <td>
      <div class="font-weight-medium">{{ item.order_ref }}</div>
      <div class="text-caption">#{{ item.id }}</div>
    </td>

    <!-- CUSTOMER -->
    <td>
      <div>{{ item.name }}</div>
      <div class="text-caption">{{ item.phone }}</div>
    </td>

    <!-- PRODUCT -->
    <td>
      <div>{{ item.item }}</div>
      <div class="text-caption">{{ item.category }}</div>
    </td>

    <!-- VARIANT -->
    <td>
      <div>{{ item.variant_title || '—' }}</div>
      <div class="text-caption">
        {{ item.variant_color }} / {{ item.variant_size }}
      </div>
      <div class="text-caption">SKU: {{ item.variant_sku }}</div>
    </td>

    <!-- QTY -->
    <td>{{ item.quantity }}</td>

    <!-- AMOUNT -->
    <td class="font-weight-medium">₹ {{ item.total_amount }}</td>

    <!-- PAYMENT -->
    <td>
      <div>{{ item.payment_method || '—' }}</div>
      <v-chip
        size="small"
        :color="
          item.payment_status === 'paid'
            ? 'green'
            : item.payment_status === 'failed'
            ? 'red'
            : 'orange'
        "
      >
        {{ item.payment_status }}
      </v-chip>
    </td>

    <!-- STATUS -->
    <td>
      <v-chip
        size="small"
        :color="
          item.status === 'delivered'
            ? 'green'
            : item.status === 'cancelled'
            ? 'red'
            : 'blue'
        "
      >
        {{ item.status }}
      </v-chip>
    </td>

    <!-- DATE -->
    <td>{{ dayjs(item.created_at).format('DD MMM YYYY') }}</td>

    <!-- ACTION -->
    <td>
      <v-menu>
        <template #activator="{ props }">
          <v-btn icon="mdi-dots-vertical" variant="text" v-bind="props" />
        </template>

        <v-list>
          <v-list-item
            v-for="s in allowedTransitions[item.status] || []"
            :key="s"
            @click.stop="updateOrderStatus(item, s)"
          >
            <v-list-item-title>Mark as {{ s }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </td>
  </tr>
</template>

      </v-data-table>
     <v-navigation-drawer v-model="detailsDrawer" location="right" width="460" temporary>
  <v-card v-if="selectedOrder">

    <v-card-title class="d-flex justify-space-between">
      Order {{ selectedOrder.order_ref }}
      <v-btn icon="mdi-close" variant="text" @click="detailsDrawer = false" />
    </v-card-title>

    <v-divider />

    <v-card-text class="text-body-2">

      <!-- CUSTOMER -->
      <h4>Customer</h4>
      <div><strong>Name:</strong> {{ selectedOrder.name }}</div>
      <div><strong>Email:</strong> {{ selectedOrder.email }}</div>
      <div><strong>Phone:</strong> {{ selectedOrder.phone }}</div>

      <v-divider class="my-3" />

      <!-- ADDRESS -->
      <h4>Shipping Address</h4>
      <div>{{ selectedOrder.address }}</div>
      <div>Pincode: {{ selectedOrder.pincode }}</div>

      <v-divider class="my-3" />

      <!-- PRODUCT -->
      <h4>Product</h4>
      <div><strong>Item:</strong> {{ selectedOrder.item }}</div>
      <div><strong>Category:</strong> {{ selectedOrder.category }}</div>

      <v-divider class="my-3" />

      <!-- VARIANT SNAPSHOT -->
      <h4>Variant Details</h4>
      <div><strong>Title:</strong> {{ selectedOrder.variant_title }}</div>
      <div><strong>Color:</strong> {{ selectedOrder.variant_color }}</div>
      <div><strong>Size:</strong> {{ selectedOrder.variant_size }}</div>
      <div><strong>SKU:</strong> {{ selectedOrder.variant_sku }}</div>
      <div><strong>Variant Price:</strong> ₹ {{ selectedOrder.variant_price }}</div>

      <v-divider class="my-3" />

      <!-- PRICING -->
      <h4>Pricing</h4>
      <div>Quantity: {{ selectedOrder.quantity }}</div>
      <div>Unit Price: ₹ {{ selectedOrder.unit_price }}</div>
      <div class="font-weight-medium">
        Line Total: ₹ {{ selectedOrder.line_total }}
      </div>

      <v-divider class="my-3" />

      <!-- PAYMENT -->
      <h4>Payment</h4>
      <div>Method: {{ selectedOrder.payment_method }}</div>
      <v-chip
        size="small"
        :color="
          selectedOrder.payment_status === 'paid'
            ? 'green'
            : selectedOrder.payment_status === 'failed'
            ? 'red'
            : 'orange'
        "
      >
        {{ selectedOrder.payment_status }}
      </v-chip>

      <v-divider class="my-3" />

      <!-- STATUS -->
      <h4>Status</h4>
      <v-select
        :items="allowedTransitions[selectedOrder.status] || []"
        label="Update Status"
        @update:modelValue="s => updateOrderStatus(selectedOrder, s)"
      />

      <v-divider class="my-3" />

      <div class="text-caption">
        Ordered on {{ dayjs(selectedOrder.created_at).format('DD MMM YYYY, hh:mm A') }}
      </div>

    </v-card-text>
  </v-card>
</v-navigation-drawer>


    </v-card>
  </div>
</template>
