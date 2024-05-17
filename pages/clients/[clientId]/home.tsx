import { GetServerSideProps } from 'next';
import BottomNav from '@/components/BottomNav';

interface HomeProps {
  clientId: string;
}

const Home: React.FC<HomeProps> = ({ clientId }) => {
  return (
    <div>
      <h2>Home do Cliente {clientId}</h2>
      <BottomNav clientId={clientId} />
    </div>
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
