import { GetServerSideProps } from 'next';
import { useCart } from '@/context/CartContext';
import { Box, Button, Card, CardActions, CardContent, CardMedia, Container, Grid, Typography, Snackbar, Alert, styled } from '@mui/material';
import BottomNav from '@/components/BottomNav';
import { PromotionItem } from '@/mockData';
import { useState } from 'react';

const StyledTypography = styled(Typography)({
  fontWeight: 'bold',
  color: '#3f51b5',
  textAlign: 'center',
  marginBottom: '20px',
});

interface PromotionProps {
  clientId: string;
  promotionItems: PromotionItem[];
}

const Promotion: React.FC<PromotionProps> = ({ clientId, promotionItems }) => {
  const { addToCart } = useCart();
  const [open, setOpen] = useState(false);

  const handleAddToCart = (item: PromotionItem) => {
    addToCart({
      ...item, quantity: 1, type: 'promotion',
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
    <Box sx={{ paddingBottom: '56px' }}> {/* Adicione paddingBottom */}
      <Container>
        <StyledTypography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            fontWeight: 'bold', 
            color: 'purple', 
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)' 
          }}
        >
          Promoções {clientId}
        </StyledTypography>
        <Grid container spacing={3}>
          {promotionItems.map((item) => (
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
                    color="secondary"
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { params } = context;

  if (!params || !params.clientId) {
    console.error('ClientId não encontrado nos parâmetros');
    return {
      notFound: true,
    };
  }

  const clientId = params.clientId as string;
  const res = await fetch(`${process.env.API_URL}/api/clients/${clientId}/promotions`);

  if (!res.ok) {
    console.error('Erro ao carregar os itens de promoção');
    return {
      notFound: true,
    };
  }

  const data = await res.json();

  return {
    props: {
      clientId,
      promotionItems: data.promotionItems || [],
    },
  };
};

export default Promotion;
