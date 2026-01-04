<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/composables/useSupabase'

type Banner = {
  id?: string
  title: string | null
  subtitle: string | null
  image_url: string
  link_url: string | null
  is_active: boolean
  sort_order: number
  created_at?: string
}

/* ================= STATE ================= */
const banners = ref<Banner[]>([])
const loading = ref(false)

const dialog = ref(false)
const isEdit = ref(false)

const form = ref<Banner>({
  title: '',
  subtitle: '',
  image_url: '',
  link_url: '',
  is_active: true,
  sort_order: 0,
})

/* ================= FETCH ================= */
const fetchBanners = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('homepage_banners')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error(error)
  } else {
    banners.value = data || []
  }

  loading.value = false
}

onMounted(fetchBanners)

/* ================= ACTIONS ================= */
const openAdd = () => {
  isEdit.value = false
  form.value = {
    title: '',
    subtitle: '',
    image_url: '',
    link_url: '',
    is_active: true,
    sort_order: banners.value.length + 1,
  }
  dialog.value = true
}

const openEdit = (banner: Banner) => {
  isEdit.value = true
  form.value = { ...banner }
  dialog.value = true
}

const saveBanner = async () => {
  loading.value = true

  const payload = { ...form.value }

  const { error } =
    isEdit.value && payload.id
      ? await supabase
          .from('homepage_banners')
          .update(payload)
          .eq('id', payload.id)
      : await supabase
          .from('homepage_banners')
          .insert([payload])

  if (error) {
    alert(error.message)
    console.error(error)
  }

  dialog.value = false
  await fetchBanners()
  loading.value = false
}

const deleteBanner = async (id: string) => {
  if (!confirm('Delete this banner?')) return

  await supabase.from('homepage_banners').delete().eq('id', id)
  fetchBanners()
}

const toggleActive = async (banner: Banner) => {
  await supabase
    .from('homepage_banners')
    .update({ is_active: !banner.is_active })
    .eq('id', banner.id)

  fetchBanners()
}
</script>

<template>
  <div>
    <!-- HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h2>Homepage Banners</h2>
      <v-btn color="primary" @click="openAdd">
        + Add Banner
      </v-btn>
    </div>

    <!-- TABLE -->
    <v-card>
      <v-data-table
        :items="banners"
        :loading="loading"
        item-key="id"
      >
        <template #headers>
          <tr>
            <th>Preview</th>
            <th>Title</th>
            <th>Status</th>
            <th>Order</th>
            <th>Actions</th>
          </tr>
        </template>

        <template #item="{ item }">
          <tr>
            <td>
              <v-img
                :src="item.image_url"
                width="120"
                height="60"
                cover
                class="rounded"
              />
            </td>

            <td>
              <strong>{{ item.title || '—' }}</strong>
              <div class="text-caption">
                {{ item.subtitle }}
              </div>
            </td>

            <td>
              <v-switch
                :model-value="item.is_active"
                @update:modelValue="() => toggleActive(item)"
                inset
                color="green"
              />
            </td>

            <td>
              {{ item.sort_order }}
            </td>

            <td>
              <v-btn
                icon="mdi-pencil"
                variant="text"
                @click="openEdit(item)"
              />
              <v-btn
                icon="mdi-delete"
                variant="text"
                color="error"
                @click="deleteBanner(item.id)"
              />
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>

    <!-- ADD / EDIT DIALOG -->
    <v-dialog v-model="dialog" max-width="600">
      <v-card>
        <v-card-title>
          {{ isEdit ? 'Edit Banner' : 'Add Banner' }}
        </v-card-title>

        <v-card-text>
          <v-text-field
            label="Title"
            v-model="form.title"
          />

          <v-text-field
            label="Subtitle"
            v-model="form.subtitle"
          />

          <v-text-field
            label="Image URL"
            v-model="form.image_url"
            required
          />

          <v-img
            v-if="form.image_url"
            :src="form.image_url"
            height="140"
            class="mb-3 rounded"
            cover
          />

          <v-text-field
            label="Link URL"
            v-model="form.link_url"
            placeholder="/shop or https://example.com"
          />

          <v-text-field
            label="Sort Order"
            type="number"
            v-model.number="form.sort_order"
          />

          <v-switch
            label="Active"
            v-model="form.is_active"
            inset
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">
            Cancel
          </v-btn>
          <v-btn color="primary" @click="saveBanner">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
