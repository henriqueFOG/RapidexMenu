import { GetStaticProps, GetStaticPaths } from 'next';
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

export const getStaticProps: GetStaticProps = async (context) => {
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

export default Home;
