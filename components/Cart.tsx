import { useCart } from '@/context/CartContext';
import { Card, CardContent, CardActions, Button, Typography, Container, Grid } from '@mui/material';
import BottomNav from '@/components/BottomNav';
import { styled } from '@mui/system';

interface CartProps {
  clientId: string;
}

const Root = styled('div')({
  flexGrow: 1,
  marginTop: '20px',
});

const CustomCard = styled(Card)({
  minWidth: 275,
  marginBottom: '20px',
});

const CustomButton = styled(Button)({
  margin: '0 10px',
});

const Cart: React.FC<CartProps> = ({ clientId }) => {
  const { cart, removeFromCart } = useCart();

  return (
    <Container component={Root}>
      <Typography variant="h4" gutterBottom>
        Carrinho do Cliente {clientId}
      </Typography>
      <Grid container spacing={3}>
        {cart.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <CustomCard>
              <CardContent>
                <Typography variant="h5" component="div">
                  {item.title}
                </Typography>
                <Typography color="textSecondary">
                  R$ {item.price.toFixed(2)}
                </Typography>
                <Typography variant="body2" component="p">
                  Quantidade: {item.quantity}
                </Typography>
              </CardContent>
              <CardActions>
                <CustomButton
                  size="small"
                  variant="contained"
                  color="secondary"
                  onClick={() => removeFromCart(item.id, 'menu')}
                >
                  Remover
                </CustomButton>
              </CardActions>
            </CustomCard>
          </Grid>
        ))}
      </Grid>
      <BottomNav clientId={clientId} />
    </Container>
  );
};

export default Cart;
