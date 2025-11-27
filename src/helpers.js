// src/helpers.js
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Decimal from 'decimal.js';
import fs from 'fs';
import path from 'path';

export function loadConfig(fileName) {
  const filePath = path.resolve(process.cwd(), 'configs', fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function calcPotentialWinnings(stake, odd) {
  const s = new Decimal(stake);
  const o = new Decimal(odd);
  return s.mul(o).toFixed(2);
}

export function multiplyOdds(oddsArray) {
  let product = new Decimal(1);
  oddsArray.forEach(o => product = product.mul(new Decimal(o)));
  return product.toNumber();
}