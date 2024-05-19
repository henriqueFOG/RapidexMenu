import React, { useState } from 'react';
import { Box, Button, Card, CardActions, CardContent, CardMedia, Grid, Typography, Modal, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { PromotionItem } from '@/mockData';
import { useDropzone, Accept } from 'react-dropzone';
import Image from 'next/image';

interface AdminPromotionItemsProps {
  clientId: string;
  promotionItems: PromotionItem[];
}

const AdminPromotionItems: React.FC<AdminPromotionItemsProps> = ({ clientId, promotionItems }) => {
  const [items, setItems] = useState<PromotionItem[]>(promotionItems);
  const [open, setOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<PromotionItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);

  const handleOpen = (item: PromotionItem | null = null) => {
    setCurrentItem(item);
    setIsEditing(!!item);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentItem(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    let updatedItems: PromotionItem[];
    if (isEditing && currentItem) {
      updatedItems = items.map(item => (item.id === currentItem.id ? currentItem : item));
    } else if (currentItem) {
      updatedItems = [...items, { ...currentItem, id: Date.now() }];
    } else {
      return;
    }
    setItems(updatedItems);
    handleClose();

    try {
      await savePromotionItemsToServer(clientId, updatedItems);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar os itens de promoção.');
    }
  };

  const handleDelete = async (id: number) => {
    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);

    try {
      await savePromotionItemsToServer(clientId, updatedItems);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar os itens de promoção.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentItem({ ...currentItem, [name]: value } as PromotionItem);
  };

  const confirmDelete = async () => {
    if (deleteItemId !== null) {
      const updatedItems = items.filter(item => item.id !== deleteItemId);
      setItems(updatedItems);

      try {
        await savePromotionItemsToServer(clientId, updatedItems);
      } catch (error) {
        console.error(error);
        alert('Erro ao salvar os itens de promoção.');
      }
    }
    setOpenDialog(false);
    setDeleteItemId(null);
  };

  const onDrop = (acceptedFiles: File[]) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (currentItem) {
        setCurrentItem({ ...currentItem, image: reader.result as string });
      }
    };
    reader.readAsDataURL(acceptedFiles[0]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: 'image/*' as unknown as Accept });

  return (
    <Box>
      <Button variant="contained" color="primary" onClick={() => handleOpen()}>
        Criar Novo Item
      </Button>
      <Grid container spacing={3}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <Card>
              <CardMedia component="img" height="140" image={item.image} alt={item.title} />
              <CardContent>
                <Typography variant="h5">{item.title}</Typography>
                <Typography color="textSecondary">{item.description}</Typography>
                <Typography variant="body2" component="p">
                  R$ {typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
                </Typography>
                <Typography variant="body2" component="p">
                  Categoria: {item.category}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" variant="contained" color="secondary" onClick={() => handleOpen(item)}>
                  Alterar
                </Button>
                <Button size="small" variant="contained" color="warning" onClick={() => handleDelete(item.id)}>
                  Excluir
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Modal open={open} onClose={handleClose}>
        <Box sx={{ maxHeight: '90vh', overflow: 'auto', padding: 2, backgroundColor: 'white', margin: 'auto', marginTop: '5%', width: 400 }}>
          <Typography variant="h6" gutterBottom>
            {isEditing ? 'Alterar Item' : 'Criar Novo Item'}
          </Typography>
          <TextField label="Título" name="title" value={currentItem?.title || ''} onChange={handleChange} fullWidth margin="normal" />
          <TextField label="Descrição" name="description" value={currentItem?.description || ''} onChange={handleChange} fullWidth margin="normal" />
          <TextField label="Preço" name="price" type="number" value={currentItem?.price || ''} onChange={handleChange} fullWidth margin="normal" />
          <TextField label="Categoria" name="category" value={currentItem?.category || ''} onChange={handleChange} fullWidth margin="normal" />
          <div {...getRootProps()} style={{ border: '1px dashed gray', padding: '20px', textAlign: 'center', marginTop: '20px' }}>
            <input {...getInputProps()} />
            {currentItem?.image ? (
              <Box sx={{ position: 'relative', width: '100%', height: 200 }}>
                <Image src={currentItem.image as string} alt="Imagem do Item" layout="fill" objectFit="cover" />
              </Box>
            ) : (
              <p>Arraste e solte uma imagem aqui, ou clique para selecionar uma imagem</p>
            )}
          </div>
          <Button variant="contained" color="primary" onClick={handleSave} sx={{ mt: 2 }}>
            Salvar
          </Button>
        </Box>
      </Modal>
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>{"Confirmação de Exclusão"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza de que deseja excluir este item?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="primary">
            Não
          </Button>
          <Button onClick={confirmDelete} color="warning" autoFocus>
            Sim
          </Button>
        </DialogActions>
      </Dialog> 
    </Box>
  );
};

const savePromotionItemsToServer = async (clientId: string, promotionItems: PromotionItem[]) => {
  const res = await fetch(`/api/clients/${clientId}/promotions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(promotionItems),
  });
  if (!res.ok) {
    throw new Error('Erro ao salvar os itens de promoção.');
  }
};

export default AdminPromotionItems;
