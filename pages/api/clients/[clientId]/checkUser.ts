import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { usuario } = req.body;

    const filePath = path.resolve('./data/Cadastro.json');
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(jsonData);

    const userExists = data.Cadastro.some((user: any) => user.usuario === usuario);

    if (userExists) {
      res.status(200).json({ exists: true });
    } else {
      res.status(200).json({ exists: false });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
