<script setup lang="ts">
import {
  ref,
  onMounted,
  computed,
  onBeforeUnmount,
} from 'vue'
import { supabase } from '@/composables/useSupabase'

/* ================= TYPES ================= */
type Product = {
  id?: number
  title: string
  description: string | null
  category: string | null
  price: number
  image1: string | null
  image2: string | null
  image3: string | null
  image4: string | null
  image5: string | null
  marketing_pitch: string | null
  created_at?: string

  // 🔥 Inventory
  stock_quantity: number
  low_stock_threshold: number
  inventory_status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

const inventoryStats = computed(() => ({
  inStock: products.value.filter(p => p.inventory_status === 'in_stock').length,
  low: products.value.filter(p => p.inventory_status === 'low_stock').length,
  out: products.value.filter(p => p.inventory_status === 'out_of_stock').length,
}))

/* ================= STATE ================= */
const products = ref<Product[]>([])
const loading = ref(false)

const search = ref('')
const categoryFilter = ref<string | null>(null)
const viewMode = ref<'table' | 'grid'>('table')

/* dialogs */
const dialog = ref(false)
const previewDialog = ref(false)

const isEdit = ref(false)
const selectedProduct = ref<Product | null>(null)

/* form */
const form = ref<Product>({
  title: '',
  description: '',
  category: '',
  price: 0,
  image1: '',
  image2: '',
  image3: '',
  image4: '',
  image5: '',
  marketing_pitch: '',
  stock_quantity: 10,
  low_stock_threshold: 5,
  inventory_status: 'in_stock',
})

const inventoryColor = (status: string) => {
  if (status === 'in_stock') return 'green'
  if (status === 'low_stock') return 'orange'
  return 'red'
}

/* ================= FETCH ================= */
const fetchProducts = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) console.error('Fetch error:', error)
  products.value = data || []

  loading.value = false
}

onMounted(fetchProducts)

/* ================= REALTIME ================= */
const channel = supabase
  .channel('realtime-products')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'products' },
    fetchProducts
  )
  .subscribe()

/* ================= FILTER ================= */
const categories = computed(() =>
  [...new Set(products.value.map(p => p.category).filter(Boolean))]
)

const filteredProducts = computed(() =>
  products.value.filter(p => {
    const matchSearch =
      p.title.toLowerCase().includes(search.value.toLowerCase())
    const matchCategory =
      !categoryFilter.value || p.category === categoryFilter.value
    return matchSearch && matchCategory
  })
)

/* ================= PREVIEW IMAGES ================= */
const previewImages = computed(() => {
  if (!selectedProduct.value) return []
  return [
    selectedProduct.value.image1,
    selectedProduct.value.image2,
    selectedProduct.value.image3,
    selectedProduct.value.image4,
    selectedProduct.value.image5,
  ].filter((img): img is string => !!img)
})

/* ================= ACTIONS ================= */
const openAdd = () => {
  isEdit.value = false
  selectedProduct.value = null

  form.value = {
    title: '',
    description: '',
    category: '',
    price: 0,
    image1: '',
    image2: '',
    image3: '',
    image4: '',
    image5: '',
    marketing_pitch: '',
    stock_quantity: 10,
  low_stock_threshold: 5,
  inventory_status: 'in_stock'
  }

  dialog.value = true
}

const openEdit = (product: Product) => {
  isEdit.value = true
  selectedProduct.value = product
  form.value = { ...product }
  dialog.value = true
}

const openPreview = (product: Product) => {
  selectedProduct.value = product
  previewDialog.value = true
}
/*================== PARSE DESCRIPTION ================= */
const parsedDescription = computed(() => {
  if (!selectedProduct.value?.description) return null

  const text = selectedProduct.value.description

  const [descPart, detailsPart] = text.split(/Product Details/i)

  return {
    description: descPart?.trim(),
    details: detailsPart?.trim(),
  }
})

const productDetails = computed(() => {
  if (!parsedDescription.value?.details) return []

  return parsedDescription.value.details
    .split('\n')
    .map(line => {
      const [key, value] = line.split(':')
      if (!key || !value) return null
      return {
        key: key.trim(),
        value: value.trim(),
      }
    })
    .filter(Boolean)
})

/* ================= SAVE ================= */
const saveProduct = async () => {
  loading.value = true

  // description already bound via v-model
  const { error } = isEdit.value && form.value.id
    ? await supabase.from('products').update(form.value).eq('id', form.value.id)
    : await supabase.from('products').insert([form.value])

  if (error) {
    console.error('Save error:', error)
    alert(error.message)
  }

  dialog.value = false
  await fetchProducts()
  loading.value = false
}


/* ================= DELETE ================= */
const deleteProduct = async (id: number) => {
  if (!confirm('Delete this product?')) return
  await supabase.from('products').delete().eq('id', id)
}

/* ================= CSV IMPORT (SAFE) ================= */
const handleCSVUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const text = await file.text()
  const lines = text.split('\n').filter(Boolean)

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1)

  const productsToInsert = rows.map(row => {
    const values = row.split(',')
    const p: any = {}

    headers.forEach((h, i) => {
      p[h] = values[i]?.trim() || null
    })

    p.price = Number(p.price || 0)
    p.description = p.description || ''
    return p
  })

  const { error } = await supabase.from('products').insert(productsToInsert)
  if (error) alert(error.message)
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
      <h2>Products</h2>

      <div class="d-flex align-center">
        <v-btn-toggle
          v-model="viewMode"
          mandatory
          class="mr-4"
        >
          <v-btn value="table" icon="mdi-table" />
          <v-btn value="grid" icon="mdi-view-grid" />
        </v-btn-toggle>

        <v-btn variant="outlined" class="mr-2">
          <label style="cursor:pointer">
            Import CSV
            <input type="file" hidden accept=".csv" @change="handleCSVUpload" />
          </label>
        </v-btn>

        <v-btn color="primary" @click="openAdd">+ Add Product</v-btn>
      </div>
    </div>

    <!-- FILTER -->
    <v-card class="mb-4 pa-3">
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field v-model="search" label="Search products" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="categoryFilter"
            :items="categories"
            label="Category"
            clearable
          />
        </v-col>
      </v-row>
    </v-card>

    <v-row class="mb-4">
  <v-col cols="4">
    <v-card color="green" class="pa-4 text-white">
      In Stock: {{ inventoryStats.inStock }}
    </v-card>
  </v-col>
  <v-col cols="4">
    <v-card color="orange" class="pa-4 text-white">
      Low Stock: {{ inventoryStats.low }}
    </v-card>
  </v-col>
  <v-col cols="4">
    <v-card color="red" class="pa-4 text-white">
      Out of Stock: {{ inventoryStats.out }}
    </v-card>
  </v-col>
</v-row>

    <!-- TABLE VIEW -->
    <v-card v-if="viewMode === 'table'">
      <v-data-table :items="filteredProducts" :loading="loading">
        <template #headers>
          <tr>
            <th>Image</th>
            <th>Title</th>
            <th>Category</th>
            <th>Price</th>
            <th>Actions</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Variants</th>
          </tr>
        </template>

        <template #item="{ item }">
          <tr>
            <td>
              <v-avatar size="48">
                <v-img :src="item.image1" />
              </v-avatar>
            </td>
            <td><strong>{{ item.title }}</strong></td>
            <td>{{ item.category }}</td>
            <td>₹ {{ item.price }}</td>
            <td>
              <v-btn icon="mdi-eye" @click="openPreview(item)" />
              <v-btn icon="mdi-pencil" @click="openEdit(item)" />
              <v-btn icon="mdi-delete" color="error" @click="deleteProduct(item.id)" />
            </td>
            <td>{{ item.stock_quantity }}</td>

<td>
  <v-chip
    :color="inventoryColor(item.inventory_status)"
    size="small"
    variant="flat"
  >
    {{ item.inventory_status.replace('_', ' ') }}
  </v-chip>
</td>

<td>
  <v-btn
    size="small"
    color="secondary"
    variant="tonal"
    @click="$router.push(`/products/${item.id}/variants`)"
  >
    + Variant
  </v-btn>
</td>

          </tr>
        </template>
      </v-data-table>
    </v-card>

    <!-- GRID VIEW -->
    <v-row v-else dense>
      <v-col
        v-for="product in filteredProducts"
        :key="product.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card class="h-100">
          <v-img :src="product.image1" height="160" cover />
          <v-card-text class="pb-0">
            <strong class="d-block text-truncate">
              {{ product.title }}
            </strong>
            <div class="text-caption text-grey">{{ product.category }}</div>
            <div class="font-weight-bold mt-1">₹ {{ product.price }}</div>
          </v-card-text>
          <v-chip
  class="position-absolute ma-2"
  :color="inventoryColor(product.inventory_status)"
  size="small"
>
  {{ product.inventory_status.replace('_', ' ') }}
</v-chip>

          <v-card-actions>
            <v-spacer />
            <v-btn icon="mdi-eye" @click="openPreview(product)" />
            <v-btn icon="mdi-pencil" @click="openEdit(product)" />
            <v-btn icon="mdi-delete" color="error" @click="deleteProduct(product.id)" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- PREVIEW MODAL -->
    <v-dialog v-model="previewDialog" max-width="900">
      <v-card v-if="selectedProduct">
        <v-row>
          <v-col cols="12" md="6">
            <v-carousel v-if="previewImages.length" height="400">
              <v-carousel-item
                v-for="(img, i) in previewImages"
                :key="i"
              >
                <v-img :src="img" cover />
              </v-carousel-item>
            </v-carousel>

            <v-sheet
              v-else
              height="400"
              class="d-flex align-center justify-center"
            >
              No images
            </v-sheet>
          </v-col>

          <v-col cols="12" md="6" class="pa-6">
            <h2>{{ selectedProduct.title }}</h2>
            <h3>₹ {{ selectedProduct.price }}</h3>
            <p>{{ selectedProduct.marketing_pitch }}</p>
            <div v-html="selectedProduct.description" />
          </v-col>
        </v-row>
      </v-card>
    </v-dialog>

    <!-- ADD / EDIT -->
    <v-dialog v-model="dialog" max-width="720">
      <v-card>
        <v-card-title>{{ isEdit ? 'Edit' : 'Add' }} Product</v-card-title>
        <v-card-text>
          <v-text-field label="Title" v-model="form.title" />
          <v-text-field label="Category" v-model="form.category" />
          <v-text-field type="number" label="Price" v-model.number="form.price" />

          <v-row>
            <v-col v-for="i in 5" :key="i" cols="12" md="6">
              <v-text-field :label="`Image ${i}`" v-model="form[`image${i}`]" />
            </v-col>
          </v-row>

          <v-textarea label="Marketing Pitch" v-model="form.marketing_pitch" />
               

          <v-divider class="my-6" />

<h3 class="mb-3">Inventory</h3>

<v-row>
  <v-col cols="12" md="6">
    <v-text-field
      type="number"
      label="Stock Quantity"
      v-model.number="form.stock_quantity"
      min="0"
    />
  </v-col>

  <v-col cols="12" md="6">
    <v-text-field
      type="number"
      label="Low Stock Threshold"
      v-model.number="form.low_stock_threshold"
      min="1"
    />
  </v-col>
</v-row>

<v-alert
  v-if="form.inventory_status === 'out_of_stock'"
  type="error"
  variant="tonal"
>
  This product is currently out of stock
</v-alert>

<v-alert
  v-else-if="form.inventory_status === 'low_stock'"
  type="warning"
  variant="tonal"
>
  Low stock warning
</v-alert>

<!--description -->
         <v-textarea
  v-model="form.description"
  label="Product Description"
  variant="outlined"
  rows="6"
  auto-grow
  clearable
  placeholder="Write product description..."
/>
<div v-if="parsedDescription?.description">
  <p
    v-for="(line, i) in parsedDescription.description.split('\n')"
    :key="i"
    class="mb-2"
  >
    {{ line }}
  </p>
</div>
<div v-if="productDetails.length" class="mt-6">
  <h3 class="mb-3">Product Details</h3>

  <v-table density="compact">
    <tbody>
      <tr v-for="(item, i) in productDetails" :key="i">
        <td class="font-weight-medium">{{ item.key }}</td>
        <td>{{ item.value }}</td>
      </tr>
    </tbody>
  </v-table>
</div>

        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog=false">Cancel</v-btn>
          <v-btn color="primary" @click="saveProduct">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>