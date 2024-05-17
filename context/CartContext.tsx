import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CartItem {
  id: number;
  title: string;
  description: string;
  price: number;
  quantity: number;
  type: 'menu' | 'promotion';
  image: string;
  category: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: number, type: 'menu' | 'promotion', quantity?: number) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (cartItem) => cartItem.id === item.id && cartItem.type === item.type
      );
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.id === item.id && cartItem.type === item.type
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        );
      }
      return [...prevCart, item];
    });
  };

  const removeFromCart = (id: number, type: 'menu' | 'promotion', quantity: number = 1) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === id && item.type === type) {
            if (item.quantity > quantity) {
              return { ...item, quantity: item.quantity - quantity };
            } else {
              return null; // Mark item for removal
            }
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null); // Filter out null items
    });
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
};
