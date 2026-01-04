// src/config/notificationTemplates.ts

export type NotificationTemplate = {
  id: string
  name: string
  category: 'order' | 'payment' | 'promotion' | 'system'
  title: string
  message: string
  route?: string
  url?: string
  icon?: string
  metadata?: Record<string, any>
}

export const notificationTemplates: NotificationTemplate[] = [
  {
    id: 'order_placed',
    name: 'Order Placed',
    category: 'order',
    title: 'Order Placed 🛒',
    message: 'Your order has been placed successfully.',
    route: '/orders',
    icon: 'bi bi-bag-check',
    metadata: { priority: 'high', type: 'order' }
  },
  {
    id: 'payment_success',
    name: 'Payment Successful',
    category: 'payment',
    title: 'Payment Successful 💸',
    message: 'Your payment has been verified successfully.',
    route: '/orders',
    icon: 'bi bi-credit-card',
    metadata: { priority: 'high', type: 'payment' }
  },
  {
    id: 'payment_failed',
    name: 'Payment Failed',
    category: 'payment',
    title: 'Payment Failed ❌',
    message: 'Your payment failed. Please retry.',
    route: '/orders',
    icon: 'bi bi-x-circle',
    metadata: { priority: 'high', type: 'payment' }
  },
  {
    id: 'big_sale',
    name: 'Big Sale Campaign',
    category: 'promotion',
    title: '🔥 Big Sale Alert!',
    message: 'Flat 30% OFF on trending products. Limited time!',
    route: '/shop',
    url: 'https://qwixkart.com/offers',
    icon: 'bi bi-percent',
    metadata: { priority: 'medium', campaign: 'big_sale_2025' }
  },
  {
    id: 'system_update',
    name: 'System Update',
    category: 'system',
    title: 'System Update',
    message: 'We have updated our app for better performance.',
    route: '/profile',
    icon: 'bi bi-info-circle',
    metadata: { priority: 'low', type: 'system' }
  },
  {
    id: 'external_notice',
    name: 'External Announcement',
    category: 'system',
    title: '📢 Important Announcement',
    message: 'Read the full announcement on our website.',
    url: 'https://qwixkart.com/announcement',
    icon: 'bi bi-box-arrow-up-right',
    metadata: { priority: 'medium', external: true }
  }
]
