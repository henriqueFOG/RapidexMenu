import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { clientId } = req.query;

  if (req.method === 'POST') {
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${clientId}.json`);

    try {
      const menuItems = req.body;
      fs.writeFileSync(filePath, JSON.stringify({ menuItems }, null, 2));
      res.status(200).json({ message: 'Menu items saved successfully.' });
    } catch (error) {
      console.error('Error writing file:', error);
      res.status(500).json({ error: 'Error saving menu items.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
