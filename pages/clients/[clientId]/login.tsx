import { useState } from 'react';
import { useRouter } from 'next/router';
import { TextField, Button, Container, Typography, Box, Paper, Modal } from '@mui/material';
import { styled } from '@mui/system';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import LockIcon from '@mui/icons-material/Lock';
import axios from 'axios';

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

const SignupButton = styled(Button)({
  marginTop: '20px',
  marginLeft: '10px',
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
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    endereco: '',
    numero: '',
    complemento: '',
  });

  const router = useRouter();
  const { clientId } = router.query;
  const { login } = useAuth();

  const handleLogin = () => {
    login(clientId as string, username, password);
  };

  const handleSignup = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await axios.post(`/api/clients/${clientId}/register`, formData);
      console.log('User registered:', response.data);
      setModalOpen(false);
    } catch (error) {
      console.error('Error registering user:', error);
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
        <Box display="flex" justifyContent="center">
          <LoginButton
            onClick={handleLogin}
            variant="contained"
            startIcon={<LockIcon />}
          >
            Entrar
          </LoginButton>
          <SignupButton
            onClick={handleSignup}
            variant="contained"
          >
            Cadastre-se
          </SignupButton>
        </Box>
        <Modal open={modalOpen} onClose={handleCloseModal}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 24,
              p: 4,
            }}
          >
            <Typography variant="h6" gutterBottom>
              Faça seu cadastro!
            </Typography>
            <form onSubmit={handleFormSubmit}>
              <CustomTextField
                label="Usuário"
                name="usuario"
                value={formData.usuario}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="Senha"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="Nome"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="CPF"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="Telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="Endereço"
                name="endereco"
                value={formData.endereco}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="Número"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <CustomTextField
                label="Complemento"
                name="complemento"
                value={formData.complemento}
                onChange={handleChange}
                fullWidth
                margin="normal"
                variant="outlined"
                required
              />
              <Button type="submit" variant="contained" color="primary" fullWidth>
                Cadastrar
              </Button>
            </form>
          </Box>
        </Modal>
      </LoginPaper>
    </BackgroundContainer>
  );
};

export default ClientLogin;
