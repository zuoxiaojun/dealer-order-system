import { create } from 'zustand'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  sku: string
  unit: string
  image_url: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

interface CartState {
  items: CartItem[]
  total_amount: number
  itemCount: number
  setCart: (items: CartItem[], total_amount: number) => void
  updateItemCount: () => void
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total_amount: 0,
  itemCount: 0,
  setCart: (items, total_amount) =>
    set({ items, total_amount, itemCount: items.length }),
  updateItemCount: () => {
    const { items } = get()
    set({ itemCount: items.reduce((acc, item) => acc + item.quantity, 0) })
  },
}))
