// pages/api/clients/[clientId]/promotions.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const getPromotionItems = (dataPath: string) => {
  if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return data.promotionItems || [];
  }
  return [];
};

const savePromotionItems = (dataPath: string, promotionItems: any) => {
  const data = { promotionItems };
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
      const promotionItems = getPromotionItems(dataPath);
      res.status(200).json(promotionItems);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar os itens de promoção' });
    }
  } else if (req.method === 'POST') {
    try {
      let { promotionItems } = req.body;

      // Salva as imagens e atualiza os itens de promoção com as URLs das imagens
      for (let item of promotionItems) {
        if (item.image && item.image.startsWith('data:image')) {
          const imageUrl = await saveImage(item.image, clientId as string, item.id);
          item.image = imageUrl;
        }
      }

      savePromotionItems(dataPath, promotionItems);
      res.status(200).json({ message: 'Itens de promoção salvos com sucesso' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao salvar os itens de promoção' });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }
}
