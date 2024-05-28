import { Container, Typography, Box, Grid, Paper, Button, styled } from '@mui/material';
import BottomNav from '@/components/BottomNav';
import { GetServerSideProps } from 'next';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const StyledTypography = styled(Typography)({
  fontWeight: 'bold',
  color: '#3f51b5',
  textAlign: 'center',
  marginBottom: '20px',
});

interface HomeProps {
  clientId: string;
}

const Home: React.FC<HomeProps> = ({ clientId }) => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/clients/${clientId}/login`);
    }
  }, [isAuthenticated, router, clientId]);

  if (!isAuthenticated) {
    // Retorna null ou um spinner enquanto redireciona
    return null;
  }

  return (
    <Box sx={{ paddingBottom: '56px' }}>
      <Container>
        <StyledTypography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: 'bold',
            color: 'purple',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)',
          }}
        >
          Bem-vindo ao {clientId}
        </StyledTypography>

        {/* Mensagem de autenticação */}
        <Typography variant="h6" gutterBottom>
          {isAuthenticated ? "Login realizado" : "Falta fazer login"}
        </Typography>

        {/* Banners */}
        <Grid container spacing={2} sx={{ marginBottom: '20px' }}>
          <Grid item xs={12} md={6}>
            <Paper
              sx={{
                padding: '20px',
                backgroundImage: 'url(/public/banner1.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white',
                height: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <Typography variant="h5" gutterBottom>
                Promoção Especial
              </Typography>
              <Button variant="contained" color="secondary">
                Confira
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              sx={{
                padding: '20px',
                backgroundImage: 'url(/public/banner2.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white',
                height: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <Typography variant="h5" gutterBottom>
                Novos Sabores
              </Typography>
              <Button variant="contained" color="secondary">
                Experimente
              </Button>
            </Paper>
          </Grid>
        </Grid>

        {/* Categorias */}
        <Typography variant="h5" gutterBottom>
          Categorias
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              sx={{
                padding: '20px',
                backgroundImage: 'url(/public/pizza.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white',
                height: '150px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <Typography variant="h6" gutterBottom>
                Pizzas
              </Typography>
              <Button variant="contained" color="secondary">
                Ver mais
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              sx={{
                padding: '20px',
                backgroundImage: 'url(/public/burger.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white',
                height: '150px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <Typography variant="h6" gutterBottom>
                Burgers
              </Typography>
              <Button variant="contained" color="secondary">
                Ver mais
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              sx={{
                padding: '20px',
                backgroundImage: 'url(/public/sushi.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white',
                height: '150px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <Typography variant="h6" gutterBottom>
                Sushi
              </Typography>
              <Button variant="contained" color="secondary">
                Ver mais
              </Button>
            </Paper>
          </Grid>
        </Grid>

        {/* Seção de Destaque */}
        <Box sx={{ marginTop: '40px' }}>
          <Typography variant="h5" gutterBottom>
            Destaques do Dia
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ padding: '20px', textAlign: 'center' }}>
                <Typography variant="h6">Pizza Margherita</Typography>
                <Typography variant="body1">Tomate, mussarela, manjericão</Typography>
                <Typography variant="body2">R$ 25,00</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ padding: '20px', textAlign: 'center' }}>
                <Typography variant="h6">Burger Bacon</Typography>
                <Typography variant="body1">Carne, queijo, bacon, cebola</Typography>
                <Typography variant="body2">R$ 25,00</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ padding: '20px', textAlign: 'center' }}>
                <Typography variant="h6">Sushi Roll</Typography>
                <Typography variant="body1">Arroz, nori, salmão</Typography>
                <Typography variant="body2">R$ 15,00</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
        
        <BottomNav clientId={clientId} />
      </Container>
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

  return {
    props: {
      clientId: params.clientId as string,
    },
  };
};

export default Home;
