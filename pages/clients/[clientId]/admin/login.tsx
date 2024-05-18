import React, { useState } from 'react';
import { Container, TextField, Button, Typography, Box } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

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
    <Container maxWidth="xs">
      <Box mt={5} p={3} boxShadow={3} borderRadius={2} textAlign="center">
        <Typography variant="h4" gutterBottom>
          Admin Login - {clientId}
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" color="primary" fullWidth>
            Login
          </Button>
        </form>
      </Box>
    </Container>
  );
};

export default AdminLogin;
