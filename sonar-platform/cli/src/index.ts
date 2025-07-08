#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import { walletCommand } from './commands/wallet';
import { signalCommand } from './commands/signal';
import { portfolioCommand } from './commands/portfolio';

dotenv.config();

program
  .name('sonar')
  .description('CLI for managing the Sonar whale tracking platform')
  .version('1.0.0');

program.addCommand(walletCommand);
program.addCommand(signalCommand);
program.addCommand(portfolioCommand);

program.parse();