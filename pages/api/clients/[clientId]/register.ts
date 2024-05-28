import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

type User = {
  id: number;
  usuario: string;
  password: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const {
      usuario,
      password,
      nome,
      cpf,
      telefone,
      email,
      endereco,
      numero,
      complemento,
    } = req.body;

    const filePath = path.join(process.cwd(), 'data', 'Cadastro.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileData);

    const newId = json.Cadastro.length ? json.Cadastro[json.Cadastro.length - 1].id + 1 : 1;

    const newUser: User = {
      id: newId,
      usuario,
      password,
      nome,
      cpf,
      telefone,
      email,
      endereco,
      numero,
      complemento,
    };

    json.Cadastro.push(newUser);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');

    res.status(201).json(newUser);
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
