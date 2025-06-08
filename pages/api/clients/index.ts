import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir);
    const clients = files
      .filter(file => file !== 'Cadastro.json')
      .map(file => file.replace('.json', ''));
    res.status(200).json(clients);
  } catch {
    res.status(500).json({ message: 'Erro ao listar clientes' });
  }
}
