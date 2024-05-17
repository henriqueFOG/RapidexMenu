import { useState, useEffect } from 'react';
import { Button, TextField, Card, CardContent } from '@mui/material';
import { PromotionItem } from '@/mockData';

interface PromotionsProps {
  clientId: string;
  initialPromotionItems: PromotionItem[];
}

const Promotions: React.FC<PromotionsProps> = ({ clientId, initialPromotionItems }) => {
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>(initialPromotionItems);
  const [newItem, setNewItem] = useState<PromotionItem>({ id: 0, title: '', description: '', price: 0, image: '', category: '' });

  const handleAddItem = () => {
    setPromotionItems([...promotionItems, { ...newItem, id: promotionItems.length + 1 }]);
    setNewItem({ id: 0, title: '', description: '', price: 0, image: '', category: '' });
  };

  return (
    <div>
      <h2>Promoções do Cliente {clientId}</h2>
      {promotionItems.map((item) => (
        <Card key={item.id}>
          <CardContent>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <p>R$ {item.price.toFixed(2)}</p>
          </CardContent>
        </Card>
      ))}
      <TextField
        label="Título"
        value={newItem.title}
        onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
      />
      <TextField
        label="Descrição"
        value={newItem.description}
        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
      />
      <TextField
        label="Preço"
        type="number"
        value={newItem.price}
        onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
      />
      <Button onClick={handleAddItem}>Adicionar Promoção</Button>
    </div>
  );
};

export default Promotions;
