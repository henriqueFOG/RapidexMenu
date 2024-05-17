import { useState } from 'react';
import { useRouter } from 'next/router';
import { TextField, Button, Container, Typography, Box, Paper } from '@mui/material';
import { styled } from '@mui/system';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import LockIcon from '@mui/icons-material/Lock';

const BackgroundContainer = styled(Container)({
  background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const LoginPaper = styled(Paper)({
  padding: '40px',
  textAlign: 'center',
  boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
  borderRadius: '10px',
});

const LoginButton = styled(Button)({
  marginTop: '20px',
  background: 'linear-gradient(45deg, #6a11cb, #2575fc)',
  color: 'white',
});

const CustomTextField = styled(TextField)({
  '& label.Mui-focused': {
    color: '#6a11cb',
  },
  '& .MuiInput-underline:after': {
    borderBottomColor: '#6a11cb',
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#2575fc',
    },
    '&:hover fieldset': {
      borderColor: '#6a11cb',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#6a11cb',
    },
  },
});

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
    <BackgroundContainer>
      <LoginPaper>
        <Box mb={4}>
          <Image src="/rapidex.png" alt="Logo" width={200} height={200} />
        </Box>
        <Typography variant="h4" gutterBottom>
          {clientId}
        </Typography>
        <CustomTextField
          label="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
        />
        <CustomTextField
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
        />
        <LoginButton
          onClick={handleLogin}
          variant="contained"
          startIcon={<LockIcon />}
        >
          Entrar
        </LoginButton>
      </LoginPaper>
    </BackgroundContainer>
  );
};

export default ClientLogin;
