import { GetServerSideProps } from 'next';
import { useCart } from '@/context/CartContext';
import { Button, Card, CardActions, CardContent, CardMedia, Container, Grid, Typography } from '@mui/material';
import BottomNav from '@/components/BottomNav';
import { PromotionItem } from '@/mockData';

interface PromotionProps {
  clientId: string;
  promotionItems: PromotionItem[];
}

const Promotion: React.FC<PromotionProps> = ({ clientId, promotionItems }) => {
  const { addToCart } = useCart();

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Promoções do Cliente {clientId}
      </Typography>
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
                  color="primary"
                  onClick={() => addToCart({
                    ...item, quantity: 1, type: 'promotion',
                    image: '',
                    category: ''
                  })}
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
      promotionItems: data.promotionItems || [],
    },
  };
};

export default Promotion;
