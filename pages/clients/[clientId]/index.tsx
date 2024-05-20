import { Container, Box, TextField } from '@mui/material';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import router, { useRouter } from 'next/router';

// Importação dinâmica do LogoAnimation sem SSR
const DynamicLogoAnimation = dynamic(() => import('@/components/LogoAnimation'), { ssr: false });

const IndexPage = () => {
  const router = useRouter();
  const { clientId  } = router.query;

  return (
    <Container>
      <Box sx={{ alignItems: "center", alignContent: "center", marginTop: "10rem" }}>
        <DynamicLogoAnimation path="/LogoAnimada/rapidex.json" width={300} height={300} clientId={clientId} />
      </Box>
    </Container>
  );
};

export default IndexPage;
