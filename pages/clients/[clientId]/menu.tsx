import { GetStaticProps, GetStaticPaths } from 'next';
import { useCart } from '@/context/CartContext';
import { Box, Button, Card, CardActions, CardContent, CardMedia, Container, Grid, Typography, Snackbar, Alert } from '@mui/material';
import BottomNav from '@/components/BottomNav';
import { MenuItem } from '@/mockData';
import { useState } from 'react';

interface MenuProps {
  clientId: string;
  initialMenuItems: MenuItem[];
}

const Menu: React.FC<MenuProps> = ({ clientId, initialMenuItems }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems || []);
  const { addToCart } = useCart();
  const [open, setOpen] = useState(false);

  const handleAddToCart = (item: MenuItem) => {
    addToCart({
      ...item, quantity: 1, type: 'menu',
      image: item.image || '',
      category: ''
    });
    setOpen(true);
  };

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  return (
    <Box sx={{ paddingBottom: '56px' }}>
      <Container>
        <Typography variant="h4" gutterBottom>
          Cardápio do Cliente {clientId}
        </Typography>
        <Grid container spacing={3}>
          {menuItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              <Card>
                <CardMedia
                  component="img"
                  height="140"
                  image={item.image}
                  alt={item.title}
                />
                <CardContent>
                  <Typography variant="h5" component="div">
                    {item.title}
                  </Typography>
                  <Typography color="textSecondary">
                    {item.description}
                  </Typography>
                  <Typography variant="body2" component="p">
                    R$ {item.price.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" component="p">
                    Categoria: {item.category}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={() => handleAddToCart(item)}
                  >
                    Adicionar ao Carrinho
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
        <BottomNav clientId={clientId} />
      </Container>
      <Snackbar open={open} autoHideDuration={3000} onClose={handleClose}>
        <Alert onClose={handleClose} severity="success" sx={{ width: '100%' }}>
          Item adicionado ao carrinho!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { params } = context;

  if (!params || !params.clientId) {
    console.error('ClientId não encontrado nos parâmetros');
    return {
      notFound: true,
    };
  }

  const clientId = params.clientId as string;
  const fs = require('fs');
  const path = `./data/${clientId}.json`;

  if (!fs.existsSync(path)) {
    console.error(`Arquivo JSON não encontrado: ${path}`);
    return {
      notFound: true,
    };
  }

  const data = JSON.parse(fs.readFileSync(path, 'utf8'));

  return {
    props: {
      clientId,
      initialMenuItems: data.menuItems || [],
    },
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const fs = require('fs');
  const paths = fs.readdirSync('./data').map((file: string) => ({
    params: {
      clientId: file.replace('.json', ''),
    },
  }));

  return {
    paths,
    fallback: false,
  };
};

export default Menu;
