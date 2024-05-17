import { useState } from 'react';
import { useRouter } from 'next/router';
import { TextField, Button, Container } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

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
    <Container>
      <h1>Login do Cliente {clientId}</h1>
      <TextField
        label="Usuário"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        margin="normal"
      />
      <Button onClick={handleLogin} variant="contained" color="primary">
        Entrar
      </Button>
    </Container>
  );
};

export default ClientLogin;
