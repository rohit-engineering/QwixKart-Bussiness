<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/composables/useSupabase'

/* ================= ROUTE ================= */
const route = useRoute()
const productId = Number(route.params.id)

/* ================= STATE ================= */
const product = ref<any>(null)
const variants = ref<any[]>([])
const loading = ref(false)
const viewMode = ref<'table' | 'shortlist'>('shortlist')
const dialog = ref(false)
const isEdit = ref(false)

/* ================= FORM ================= */
const form = ref({
  id: null as number | null,
  sku: '',
  title: '',
  color: '',
  size: '',
  price_override: null as number | null,

  image: '',            // primary image
  images: [] as string[], // gallery images

  stock_quantity: 0,
  low_stock_threshold: 5,
  active: true,
})

/* ================= FETCH ================= */
const fetchProduct = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, price')
    .eq('id', productId)
    .single()

  if (error) console.error(error)
  product.value = data
}

const fetchVariants = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at')

  if (error) console.error(error)
  variants.value = data || []

  loading.value = false
}

onMounted(async () => {
  await fetchProduct()
  await fetchVariants()
})

/* ================= HELPERS ================= */
const statusColor = (status: string) => {
  if (status === 'in_stock') return 'green'
  if (status === 'low_stock') return 'orange'
  return 'red'
}

/* ================= IMAGE HELPERS ================= */
const addGalleryImage = () => {
  form.value.images.push('')
}

const removeGalleryImage = (index: number) => {
  form.value.images.splice(index, 1)
}

/* ================= ACTIONS ================= */
const openAdd = () => {
  isEdit.value = false
  form.value = {
    id: null,
    sku: '',
    title: '',
    color: '',
    size: '',
    price_override: product.value?.price ?? 0,

    image: '',
    images: [],

    stock_quantity: 0,
    low_stock_threshold: 5,
    active: true,
  }
  dialog.value = true
}

const openEdit = (variant: any) => {
  isEdit.value = true
  form.value = {
    ...variant,
    images: variant.images ?? [],
  }
  dialog.value = true
}

const saveVariant = async () => {
  if (!product.value) return

  const basePayload = {
    sku: form.value.sku,
    title: form.value.title,
    color: form.value.color,
    size: form.value.size,
    price_override: form.value.price_override,
    image: form.value.image,
    images: form.value.images,
    stock_quantity: form.value.stock_quantity,
    low_stock_threshold: form.value.low_stock_threshold,
    active: form.value.active,
    product_id: productId,
    slug: `${product.value.title}-${form.value.color}-${form.value.size}`
      .toLowerCase()
      .replace(/\s+/g, '-'),
  }

  const { error } = isEdit.value
    ? await supabase
        .from('product_variants')
        .update(basePayload)
        .eq('id', form.value.id)
    : await supabase
        .from('product_variants')
        .insert([basePayload]) // ✅ NO id here

  if (error) {
    console.error(error)
    alert(error.message)
    return
  }

  dialog.value = false
  await fetchVariants()
}

const deleteVariant = async (id: number) => {
  if (!confirm('Delete this variant?')) return
  await supabase.from('product_variants').delete().eq('id', id)
  await fetchVariants()
}

/* ================= COMPUTED ================= */
import { computed } from 'vue'

const groupedVariants = computed(() => {
  const groups: Record<string, any[]> = {}

  variants.value.forEach(v => {
    const color = v.color || 'Other'
    if (!groups[color]) groups[color] = []
    groups[color].push(v)
  })

  // optional: sort sizes inside each color
  Object.values(groups).forEach(list => {
    list.sort((a, b) => (a.size || '').localeCompare(b.size || ''))
  })

  return groups
})

</script>

<template>
  <v-container>
    <!-- HEADER -->
    <v-row class="mb-4 align-center">
      <v-col>
        <h2>{{ product?.title }} – Variants</h2>
        <p class="text-grey">Base price: ₹ {{ product?.price }}</p>
      </v-col>

      <v-col class="text-right">
        <v-btn color="primary" @click="openAdd">
          + Add Variant
        </v-btn>
        <v-btn-toggle v-model="viewMode" mandatory>
  <v-btn value="shortlist">Shortlist</v-btn>
  <v-btn value="table">Table</v-btn>
</v-btn-toggle>
      </v-col>
    </v-row>

    <!-- SHORTLIST VIEW -->
<div v-if="viewMode === 'shortlist'">
  <v-row>
    <v-col
      v-for="(items, color) in groupedVariants"
      :key="color"
      cols="12"
      md="6"
      lg="4"
    >
      <v-card class="h-100">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>{{ color }}</span>
          <v-chip size="small">{{ items.length }} variants</v-chip>
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-row dense>
            <v-col
              v-for="variant in items"
              :key="variant.id"
              cols="12"
            >
              <v-card
                variant="outlined"
                class="pa-2 d-flex align-center"
              >
                <!-- IMAGE -->
                <v-avatar size="42" class="mr-3">
                  <v-img :src="variant.image || variant.images?.[0]" />
                </v-avatar>

                <!-- INFO -->
                <div class="flex-grow-1">
                  <div class="font-weight-medium">
                    Size: {{ variant.size || '—' }}
                  </div>
                  <div class="text-caption">
                    ₹ {{ variant.price_override }}
                  </div>

                  <v-chip
                    size="x-small"
                    :color="statusColor(variant.inventory_status)"
                  >
                    {{ variant.inventory_status.replace('_',' ') }}
                  </v-chip>
                </div>

                <!-- ACTIONS -->
                <div class="ml-2">
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    @click="openEdit(variant)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    color="error"
                    @click="deleteVariant(variant.id)"
                  />
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</div>

    <!-- VARIANTS TABLE -->
    <v-card v-if="viewMode === 'table'">
      <v-data-table :items="variants" :loading="loading">
        <template #headers>
          <tr>
            <th>Image</th>
            <th>Color</th>
            <th>Size</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </template>

        <template #item="{ item }">
          <tr>
            <td>
              <v-avatar size="40">
                <v-img :src="item.image || item.images?.[0]" />
              </v-avatar>
            </td>

            <td>{{ item.color }}</td>
            <td>{{ item.size }}</td>
            <td>₹ {{ item.price_override }}</td>
            <td>{{ item.stock_quantity }}</td>

            <td>
              <v-chip
                size="small"
                :color="statusColor(item.inventory_status)"
              >
                {{ item.inventory_status.replace('_', ' ') }}
              </v-chip>
            </td>

            <td>
              <v-switch v-model="item.active" disabled />
            </td>

            <td>
              <v-btn icon="mdi-pencil" @click="openEdit(item)" />
              <v-btn
                icon="mdi-delete"
                color="error"
                @click="deleteVariant(item.id)"
              />
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>

    <!-- ADD / EDIT VARIANT -->
    <v-dialog v-model="dialog" max-width="720">
      <v-card>
        <v-card-title>
          {{ isEdit ? 'Edit Variant' : 'Add Variant' }}
        </v-card-title>

        <v-card-text>
          <!-- BASIC -->
          <v-text-field label="SKU" v-model="form.sku" />
          <v-text-field label="Title" v-model="form.title" />

          <v-row>
            <v-col cols="6">
              <v-text-field label="Color" v-model="form.color" />
            </v-col>
            <v-col cols="6">
              <v-text-field label="Size" v-model="form.size" />
            </v-col>
          </v-row>

          <v-text-field
            type="number"
            label="Price Override"
            v-model.number="form.price_override"
          />

          <!-- PRIMARY IMAGE -->
          <v-divider class="my-4" />
          <h4 class="mb-2">Primary Image</h4>

          <v-text-field
            label="Primary Image URL"
            v-model="form.image"
            placeholder="https://..."
          />

          <v-img
            v-if="form.image"
            :src="form.image"
            max-height="160"
            class="rounded mb-4"
          />

          <!-- GALLERY -->
          <v-divider class="my-4" />
          <h4 class="mb-2">Gallery Images</h4>

          <v-row
            v-for="(img, index) in form.images"
            :key="index"
            align="center"
          >
            <v-col cols="10">
              <v-text-field
                :label="`Image ${index + 1}`"
                v-model="form.images[index]"
                placeholder="https://..."
              />
            </v-col>

            <v-col cols="2">
              <v-btn
                icon="mdi-delete"
                color="error"
                variant="text"
                @click="removeGalleryImage(index)"
              />
            </v-col>

            <v-col cols="12" v-if="img">
              <v-img
                :src="img"
                max-height="120"
                class="rounded mb-3"
              />
            </v-col>
          </v-row>

          <v-btn
            size="small"
            variant="outlined"
            @click="addGalleryImage"
          >
            + Add Gallery Image
          </v-btn>

          <!-- INVENTORY -->
          <v-divider class="my-6" />
          <h4 class="mb-2">Inventory</h4>

          <v-row>
            <v-col cols="6">
              <v-text-field
                type="number"
                label="Stock Quantity"
                v-model.number="form.stock_quantity"
              />
            </v-col>

            <v-col cols="6">
              <v-text-field
                type="number"
                label="Low Stock Threshold"
                v-model.number="form.low_stock_threshold"
              />
            </v-col>
          </v-row>

          <v-switch label="Active Variant" v-model="form.active" />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveVariant">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
