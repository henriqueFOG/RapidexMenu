import React from 'react';
import { Box, Container, Typography, Grid } from '@mui/material';
import withAuth from '@/hoc/withAuth';
import AdminMenuItems from '@/components/AdminMenuItems';
import AdminPromotionItems from '@/components/AdminPromotionItems';
import { GetServerSideProps } from 'next';
import { MenuItem, PromotionItem } from '@/mockData';

interface AdminDashboardProps {
  clientId: string;
  initialMenuItems: MenuItem[];
  promotionItems: PromotionItem[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clientId, initialMenuItems, promotionItems }) => {
  return (
    <Box sx={{ paddingBottom: '56px', paddingTop: '20px' }}>
      <Container>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'purple', textAlign: 'center', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)' }}>
          Painel Administrativo - {clientId}
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <AdminMenuItems clientId={clientId} initialMenuItems={initialMenuItems} />
          </Grid>
          <Grid item xs={12}>
            <AdminPromotionItems clientId={clientId} promotionItems={promotionItems} />
          </Grid>
        </Grid>
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
      promotionItems: data.promotionItems || [],
    },
  };
};

export default withAuth(AdminDashboard);
