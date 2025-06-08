import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ message: 'Dados incompletos' });
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'Cadastro.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const user = data.Cadastro.find((u: any) => u.usuario === usuario && u.password === password);
    if (user) {
      const { password: _p, ...userData } = user;
      res.status(200).json({ user: userData });
    } else {
      res.status(401).json({ message: 'Credenciais inválidas' });
    }
  } catch {
    res.status(500).json({ message: 'Erro ao verificar usuário' });
  }
}
