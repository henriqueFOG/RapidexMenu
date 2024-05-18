import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { clientId } = req.query;

  if (req.method === 'POST') {
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${clientId}.json`);

    try {
      const promotionItems = req.body;
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      data.promotionItems = promotionItems;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      res.status(200).json({ message: 'Promotion items saved successfully.' });
    } catch (error) {
      console.error('Error writing file:', error);
      res.status(500).json({ error: 'Error saving promotion items.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
