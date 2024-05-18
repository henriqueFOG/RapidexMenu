// import React, { useState } from 'react';
// import { Box, Button, Card, CardContent, CardMedia, Typography, Grid, TextField, Modal, CardActions } from '@mui/material';
// import { HomeItem } from '@/mockData'; // Assuming you have a type HomeItem

// const AdminHomeItems = ({ clientId }: { clientId: string }) => {
//   const [homeItems, setHomeItems] = useState<HomeItem[]>([]); // Fetch initial home items from server or context
//   const [openModal, setOpenModal] = useState(false);
//   const [currentItem, setCurrentItem] = useState<HomeItem | null>(null);

//   const handleOpenModal = (item: HomeItem) => {
//     setCurrentItem(item);
//     setOpenModal(true);
//   };

//   const handleCloseModal = () => {
//     setOpenModal(false);
//     setCurrentItem(null);
//   };

//   const handleSave = () => {
//     // Save changes to the server
//     handleCloseModal();
//   };

//   const handleDelete = (itemId: number) => {
//     // Delete item from server
//     setHomeItems((prev) => prev.filter((item) => item.id !== itemId));
//   };

//   return (
//     <Box>
//       <Typography variant="h5" gutterBottom>
//         Itens da Home
//       </Typography>
//       <Grid container spacing={3}>
//         {homeItems.map((item) => (
//           <Grid item xs={12} sm={6} md={4} key={item.id}>
//             <Card>
//               <CardMedia component="img" height="140" image={item.image} alt={item.title} />
//               <CardContent>
//                 <Typography variant="h5" component="div">
//                   {item.title}
//                 </Typography>
//                 <Typography color="textSecondary">{item.description}</Typography>
//                 <Typography variant="body2" component="p">
//                   Categoria: {item.category}
//                 </Typography>
//               </CardContent>
//               <CardActions>
//                 <Button size="small" variant="contained" color="primary" onClick={() => handleOpenModal(item)}>
//                   Editar
//                 </Button>
//                 <Button size="small" variant="contained" color="secondary" onClick={() => handleDelete(item.id)}>
//                   Excluir
//                 </Button>
//               </CardActions>
//             </Card>
//           </Grid>
//         ))}
//       </Grid>
//       <Modal open={openModal} onClose={handleCloseModal}>
//         <Box sx={{ ...modalStyle }}>
//           {currentItem && (
//             <Box>
//               <TextField label="Título" fullWidth margin="normal" value={currentItem.title} />
//               <TextField label="Descrição" fullWidth margin="normal" value={currentItem.description} />
//               <TextField label="Categoria" fullWidth margin="normal" value={currentItem.category} />
//               <Button variant="contained" color="primary" onClick={handleSave}>
//                 Salvar
//               </Button>
//             </Box>
//           )}
//         </Box>
//       </Modal>
//     </Box>
//   );
// };

// const modalStyle = {
//   position: 'absolute' as 'absolute',
//   top: '50%',
//   left: '50%',
//   transform: 'translate(-50%, -50%)',
//   width: 400,
//   bgcolor: 'background.paper',
//   border: '2px solid #000',
//   boxShadow: 24,
//   p: 4,
// };

// export default AdminHomeItems;
