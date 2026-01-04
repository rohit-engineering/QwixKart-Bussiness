<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { supabase } from '@/composables/useSupabase'

const conversations = ref<any[]>([])
const messages = ref<any[]>([])
const activeConversation = ref<any>(null)
const newMessage = ref('')
const previewImage = ref<string | null>(null)
let channel: any = null

/* ---------------- LOAD CONVERSATIONS ---------------- */
const loadConversations = async () => {
  const { data, error } = await supabase
    .from('support_conversations')
    .select(`
      id,
      status,
      last_message_at,
      customer:public_profiles(id, username, avatar_url),
      unread:support_messages(count)
    `)
    .eq('support_messages.seen', false)
    .eq('support_messages.sender_role', 'customer')
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('Conversation load error:', error)
  }

  conversations.value = data || []
}

/* ---------------- LOAD MESSAGES ---------------- */
const openConversation = async (conv: any) => {
  activeConversation.value = conv
  messages.value = []

  if (channel) supabase.removeChannel(channel)

  const { data } = await supabase
    .from('support_messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('created_at')

  messages.value = data || []

  // mark customer messages as seen
  await supabase
    .from('support_messages')
    .update({ seen: true })
    .eq('conversation_id', conv.id)
    .eq('sender_role', 'customer')

  subscribeRealtime(conv.id)
  loadConversations()
  scrollBottom()
}

/* ---------------- REALTIME ---------------- */
const subscribeRealtime = (conversationId: string) => {
  channel = supabase
    .channel(`support-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      payload => {
        messages.value.push(payload.new)
        loadConversations()
        scrollBottom()
      }
    )
    .subscribe()
}

/* ---------------- SEND TEXT ---------------- */
const sendMessage = async () => {
  if (!newMessage.value || !activeConversation.value) return

  await supabase.from('support_messages').insert({
    conversation_id: activeConversation.value.id,
    sender_role: 'admin',
    type: 'text',
    content: newMessage.value
  })

  await supabase
    .from('support_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', activeConversation.value.id)

  newMessage.value = ''
}

/* ---------------- SEND IMAGE ---------------- */
const sendImage = async (file: File) => {
  if (!file || !activeConversation.value) return

  const path = `${activeConversation.value.id}/${Date.now()}-${file.name}`

  await supabase.storage.from('support-images').upload(path, file)

  const { data } = supabase.storage
    .from('support-images')
    .getPublicUrl(path)

  await supabase.from('support_messages').insert({
    conversation_id: activeConversation.value.id,
    sender_role: 'admin',
    type: 'image',
    content: data.publicUrl
  })
}

/* ---------------- SEND FILE ---------------- */
const sendFile = async (file: File) => {
  if (!file || !activeConversation.value) return

  const path = `${activeConversation.value.id}/${Date.now()}-${file.name}`

  await supabase.storage.from('support-files').upload(path, file)

  const { data } = supabase.storage
    .from('support-files')
    .getPublicUrl(path)

  await supabase.from('support_messages').insert({
    conversation_id: activeConversation.value.id,
    sender_role: 'admin',
    type: 'file',
    content: data.publicUrl,
    metadata: {
      name: file.name,
      size: file.size,
      type: file.type
    }
  })
}
/* ---------------- MARK RESOLVED ---------------- */
const markResolved = async () => {
  if (!activeConversation.value) return

  const { error } = await supabase
    .from('support_conversations')
    .update({
      status: 'resolved',
      updated_at: new Date().toISOString()
    })
    .eq('id', activeConversation.value.id)

  if (error) {
    console.error('Resolve error:', error)
    alert('Failed to mark as resolved')
    return
  }

  // update local state immediately
  activeConversation.value.status = 'resolved'

  // refresh sidebar list
  await loadConversations()
}

/* ---------------- CLOSE CHAT (DELETE EVERYTHING) ---------------- */
const closeChat = async () => {
  if (!activeConversation.value) return

  const ok = confirm(
    'This will permanently delete the entire chat. Continue?'
  )
  if (!ok) return

  // stop realtime
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }

  // delete conversation (messages auto delete via CASCADE)
  await supabase
    .from('support_conversations')
    .delete()
    .eq('id', activeConversation.value.id)

  // reset UI
  activeConversation.value = null
  messages.value = []

  // refresh list
  await loadConversations()
}

/* ---------------- IMAGE PREVIEW ---------------- */
const openPreview = (url: string) => {
  previewImage.value = url
}
const closePreview = () => {
  previewImage.value = null
}

/* ---------------- SCROLL ---------------- */
const scrollBottom = async () => {
  await nextTick()
  const el = document.getElementById('chat-scroll')
  if (el) el.scrollTop = el.scrollHeight
}

onMounted(loadConversations)

onBeforeUnmount(() => {
  if (channel) supabase.removeChannel(channel)
})
</script>

<template>
  <v-row no-gutters class="h-screen">

    <!-- 🟩 LEFT : CONVERSATIONS -->
    <v-col
  cols="3"
  class="bg-grey-darken-3 border-e h-screen overflow-y-auto"
>
  <v-list density="compact">
        <v-list-item
          v-for="c in conversations"
          :key="c.id"
          @click="openConversation(c)"
          :active="activeConversation?.id === c.id"
        >
          <template #prepend>
          <v-avatar size="40" color="grey-darken-2">
  <v-img
    v-if="c.customer?.avatar_url"
    :src="c.customer.avatar_url"
    cover
  />
  <span
    v-else
    class="text-white font-weight-bold"
  >
    {{ c.customer?.username?.charAt(0)?.toUpperCase() || '?' }}
  </span>
</v-avatar>
          </template>

          <v-list-item-title>{{ c.customer?.username }}</v-list-item-title>
          <v-list-item-subtitle>{{ c.customer?.phone }}</v-list-item-subtitle>

          <template #append>
            <v-badge
              v-if="c.unread?.[0]?.count > 0"
              :content="c.unread[0].count"
              color="red"
            >
              <v-chip
  size="x-small"
  :color="c.status === 'open'
    ? 'green'
    : c.status === 'resolved'
    ? 'blue'
    : 'grey'"
>
  {{ c.status }}
</v-chip>

            </v-badge>

            <v-chip v-else size="x-small" color="green">
              {{ c.status }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-col>

    <!-- 🟦 CENTER : CHAT -->
    <v-col cols="6" class="d-flex flex-column h-100">

      <!-- Header -->
      <v-card flat class="pa-3 border-b shrink-0 d-flex align-center justify-space-between">
  <strong>
    {{ activeConversation?.customer?.username || 'Select a chat' }}
  </strong>

  <v-chip
    v-if="activeConversation?.status === 'resolved'"
    size="small"
    color="green"
  >
    Resolved
  </v-chip>
</v-card>


      <!-- Messages -->
      <v-card id="chat-scroll" flat class="flex-grow-1 overflow-y-auto pa-4">
        <div
          v-for="m in messages"
          :key="m.id"
          class="mb-2 d-flex"
          :class="m.sender_role === 'admin' ? 'justify-end' : 'justify-start'"
        >
          <v-card
            class="pa-2"
            :style="{ maxWidth: '70%', minWidth: '220px' }"
            :color="m.sender_role === 'admin'
              ? 'blue-darken-2'
              : 'grey-darken-2'"
          >
            <div v-if="m.type === 'text'">{{ m.content }}</div>

            <v-img
              v-if="m.type === 'image'"
              :src="m.content"
              width="100%"
              max-height="240"
              min-height="120"
              cover
              class="rounded cursor-pointer"
              @click="openPreview(m.content)"
            />

            <div v-if="m.type === 'file'" class="d-flex align-center gap-2">
              <v-icon>mdi-file</v-icon>
              <span class="text-truncate">{{ m.metadata?.name }}</span>
              <v-btn size="x-small" variant="text" :href="m.content" target="_blank">
                Download
              </v-btn>
            </div>
          </v-card>
        </div>
      </v-card>

      <!-- Input -->
      <v-card flat class="pa-2 border-t shrink-0 d-flex align-center gap-2">
        <v-btn icon="mdi-image" @click="$refs.img.click()" />
        <input ref="img" type="file" hidden accept="image/*"
          @change="e => sendImage(e.target.files[0])" />

        <v-btn icon="mdi-paperclip" @click="$refs.file.click()" />
        <input ref="file" type="file" hidden
          @change="e => sendFile(e.target.files[0])" />

        <v-text-field
  v-model="newMessage"
  placeholder="Type a message"
  @keyup.enter="sendMessage"
  append-inner-icon="mdi-send"
  @click:append-inner="sendMessage"
  hide-details
  density="compact"
  :disabled="!activeConversation || activeConversation.status === 'resolved'"
/>

      </v-card>
    </v-col>

    <!-- 🟥 RIGHT : CUSTOMER INFO -->
    <v-col cols="3" class="bg-grey-darken-3 pa-3 border-s">
      <v-card flat>
        <v-card-title>Customer Info</v-card-title>

        <v-list v-if="activeConversation">
          <v-list-item>
            <v-list-item-title>
              {{ activeConversation.customer?.username }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ activeConversation.customer?.phone }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <v-divider class="my-3" />

        <v-btn
  block
  color="green"
  :disabled="!activeConversation || activeConversation.status === 'resolved'"
  @click="markResolved"
>
  Mark Resolved
</v-btn>

        <v-btn
          block
          color="red"
          class="mt-2"
          :disabled="!activeConversation"
          @click="closeChat"
        >
          Close Chat
        </v-btn>
      </v-card>
    </v-col>

    <!-- 🖼 IMAGE PREVIEW -->
    <v-dialog v-model="previewImage" fullscreen scrim="black">
      <v-card class="bg-black">
        <v-btn icon="mdi-close" variant="text" color="white" class="ma-3"
          @click="closePreview" />
        <v-img :src="previewImage" class="h-screen" contain />
      </v-card>
    </v-dialog>

  </v-row>
</template>
