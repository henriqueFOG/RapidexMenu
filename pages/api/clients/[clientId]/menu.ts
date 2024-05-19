import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Ajuste o limite conforme necessário
    },
  },
};

const getMenuItems = (dataPath: string) => {
  if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return data.menuItems || [];
  }
  return [];
};

const saveMenuItems = (dataPath: string, menuItems: any) => {
  const data = { menuItems };
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

const saveImage = async (imageBase64: string, clientId: string, id: number) => {
  const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
  const outputPath = path.join(process.cwd(), 'public', 'uploads', clientId, `${id}.png`);

  // Cria a pasta se não existir
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await sharp(buffer)
    .resize(500, 500, { fit: 'inside' }) // Ajusta o tamanho da imagem conforme necessário
    .toFile(outputPath);
  return `/uploads/${clientId}/${id}.png`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { clientId } = req.query;
  const dataPath = path.join(process.cwd(), 'data', `${clientId}.json`);

  if (req.method === 'GET') {
    try {
      const menuItems = getMenuItems(dataPath);
      res.status(200).json(menuItems);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar os itens do menu' });
    }
  } else if (req.method === 'POST') {
    try {
      let { menuItems } = req.body;

      // Salva as imagens e atualiza os itens do menu com as URLs das imagens
      for (let item of menuItems) {
        if (item.image && item.image.startsWith('data:image')) {
          const imageUrl = await saveImage(item.image, clientId as string, item.id);
          item.image = imageUrl;
        }
      }

      saveMenuItems(dataPath, menuItems);
      res.status(200).json({ message: 'Itens do menu salvos com sucesso' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao salvar os itens do menu' });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }
}
