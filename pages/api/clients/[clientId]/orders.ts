import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { clientId } = req.query;
  const dataPath = path.join(process.cwd(), 'data', `${clientId}.json`);

  if (req.method === 'GET') {
    try {
      const data = fs.existsSync(dataPath)
        ? JSON.parse(fs.readFileSync(dataPath, 'utf8'))
        : {};
      const orders = data.orders || [];
      res.status(200).json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar pedidos' });
    }
  } else if (req.method === 'POST') {
    try {
      const order = req.body;
      const data = fs.existsSync(dataPath)
        ? JSON.parse(fs.readFileSync(dataPath, 'utf8'))
        : {};
      const orders = data.orders || [];
      const newId = orders.length ? orders[orders.length - 1].id + 1 : 1;
      const newOrder = { ...order, id: newId, date: new Date().toISOString() };
      orders.push(newOrder);
      data.orders = orders;
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
      res.status(201).json(newOrder);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao salvar pedido' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
