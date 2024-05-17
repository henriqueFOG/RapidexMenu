import { ReactNode } from "react";

export interface MenuItem {
  image: string | undefined;
  category: ReactNode;
  id: number;
  title: string;
  description: string;
  price: number;
  quantity?: number; // Propriedade opcional
}

export interface PromotionItem {
  image: string | undefined;
  category: ReactNode;
  id: number;
  title: string;
  description: string;
  price: number;
}

export interface CartItem extends MenuItem {
  quantity: number;
}
