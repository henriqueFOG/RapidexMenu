import { useState } from 'react';
import { useRouter } from 'next/router';
import { TextField, Button, Container, Typography, Box } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

const ClientLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { clientId } = router.query;
  const { setClientId } = useAuth();

  const handleLogin = () => {
    // Simulando autenticação
    if (username === 'admin' && password === 'password') {
      setClientId(clientId as string);
      router.push(`/clients/${clientId}/home`);
    } else {
      alert('Credenciais inválidas');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box display="flex" flexDirection="column" alignItems="center" mt={8}>
        <Box mb={4}>
          <Image src="/logo.png" alt="Logo" width={100} height={100} />
        </Box>
        <Typography variant="h4" gutterBottom>
          Login do Cliente {clientId}
        </Typography>
        <TextField
          label="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
        />
        <TextField
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
        />
        <Button onClick={handleLogin} variant="contained" color="primary" size="large" style={{ marginTop: '20px' }}>
          Entrar
        </Button>
      </Box>
    </Container>
  );
};

export default ClientLogin;
