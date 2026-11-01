import {copyFileSync} from 'node:fs';

// Pages uploads only site/, while the README uses the source asset in the repo root.
copyFileSync('HALVETH_NETZ_HERO.svg', 'site/HALVETH_NETZ_HERO.svg');
