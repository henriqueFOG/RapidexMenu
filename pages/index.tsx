import { useRouter } from 'next/router';
import { Container, TextField, Button } from '@mui/material';
import { useState } from 'react';

const IndexPage = () => {
  const [clientId, setClientId] = useState('');
  const router = useRouter();

  const handleLogin = () => {
    router.push(`/clients/${clientId}/login`);
  };

  return (
    <Container>
      <h1>Selecione o Cliente</h1>
      <TextField
        label="Client ID"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        fullWidth
        margin="normal"
      />
      <Button onClick={handleLogin} variant="contained" color="primary">
        Entrar
      </Button>
    </Container>
  );
};

export default IndexPage;
