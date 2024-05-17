import { Container, Typography, Box, Grid } from '@mui/material';
import BottomNav from '@/components/BottomNav';
import { GetServerSideProps } from 'next';

interface HomeProps {
  clientId: string;
}

const Home: React.FC<HomeProps> = ({ clientId }) => {
  return (
    <Box sx={{ paddingBottom: '56px' }}> {/* Adicione paddingBottom */}
      <Container>
        <Typography variant="h4" gutterBottom>
          Home do Cliente {clientId}
        </Typography>
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
