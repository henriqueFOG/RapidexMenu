import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { clientId } = req.query;
  const dataPath = path.join(process.cwd(), 'data', `${clientId}.json`);

  if (req.method === 'GET') {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar os itens de promoção' });
    }
  } else if (req.method === 'POST') {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      data.promotionItems = req.body;
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      res.status(200).json({ message: 'Itens de promoção salvos com sucesso' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao salvar os itens de promoção' });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }
}
