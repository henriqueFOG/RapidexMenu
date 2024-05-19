import React, { useState } from 'react';
import { Container, TextField, Button, Typography, Box, styled, Paper } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
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

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const { clientId } = router.query;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(clientId as string, username, password);
  };

  return (
    <BackgroundContainer>
      <LoginPaper>
        <Box mb={4}>
          <Image src="/rapidex.png" alt="Logo" width={200} height={200} />
        </Box>
        <Typography variant="h4" gutterBottom>
          Acesso administradores - {clientId}
        </Typography>
        <form onSubmit={handleSubmit}>
          <CustomTextField
            label="Username"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <CustomTextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="outlined"
          />
          <LoginButton
            type="submit"
            variant="contained"
            startIcon={<LockIcon />}
            fullWidth
          >
            Login
          </LoginButton>
        </form>
      </LoginPaper>
    </BackgroundContainer>
  );
};

export default AdminLogin;
