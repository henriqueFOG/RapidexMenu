import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardActions,
  Container,
  Grid,
  Typography,
} from "@mui/material";
import { useCart } from "../context/CartContext";
import { MenuItem } from "@/mockData";
import { styled } from "@mui/system";

interface MenuProps {
  clientId: string;
  initialMenuItems: MenuItem[];
}

const CustomCard = styled(Card)({
  minWidth: 275,
  marginBottom: "20px",
});

const CustomButton = styled(Button)({
  marginTop: "10px",
});

const Menu: React.FC<MenuProps> = ({ clientId, initialMenuItems }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const { cart, addToCart } = useCart();

  const calculateTotal = () => {
    return cart
      .reduce((acc, item) => acc + item.price * item.quantity, 0)
      .toFixed(2);
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Cardápio do Cliente {clientId}
      </Typography>
      <Grid container spacing={3}>
        {menuItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <CustomCard>
              <CardContent>
                <Typography variant="h5" component="div">
                  {item.title}
                </Typography>
                <Typography color="textSecondary">
                  {item.description}
                </Typography>
                <Typography variant="body2" component="p">
                  R$ {item.price.toFixed(2)}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() =>
                    addToCart({
                      ...item,
                      quantity: 1,
                      type: "menu",
                      image: "url da imagem aqui", // Adicione a propriedade image
                      category: "categoria aqui", // Adicione a propriedade category
                    })
                  }
                >
                  Adicionar ao Carrinho
                </Button>
              </CardActions>
            </CustomCard>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" gutterBottom style={{ marginTop: "20px" }}>
        Itens no Carrinho
      </Typography>
      <Grid container spacing={3}>
        {cart.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <CustomCard>
              <CardContent>
                <Typography variant="h5" component="div">
                  {item.title}
                </Typography>
                <Typography color="textSecondary">
                  {item.description}
                </Typography>
                <Typography variant="body2" component="p">
                  R$ {item.price.toFixed(2)} x {item.quantity}
                </Typography>
              </CardContent>
            </CustomCard>
          </Grid>
        ))}
      </Grid>
      <Typography variant="h6" style={{ marginTop: "20px" }}>
        Total: R$ {calculateTotal()}
      </Typography>
    </Container>
  );
};

export default Menu;
