import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { table } from 'table';
import { getSupabaseClient } from '@sonar/database';
import type { TrackedWallet } from '@sonar/types';

const supabase = getSupabaseClient();

export const walletCommand = new Command('wallet')
  .description('Manage tracked wallets');

walletCommand
  .command('list')
  .description('List all tracked wallets')
  .option('-a, --all', 'Show inactive wallets too')
  .action(async (options) => {
    const spinner = ora('Fetching wallets...').start();
    
    try {
      let query = supabase.from('tracked_wallets').select('*');
      
      if (!options.all) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      spinner.stop();
      
      if (!data || data.length === 0) {
        console.log(chalk.yellow('No wallets found'));
        return;
      }
      
      const tableData = [
        ['Address', 'Alias', 'Tags', 'Active', 'Created'],
        ...data.map(wallet => [
          wallet.address.slice(0, 8) + '...' + wallet.address.slice(-8),
          wallet.alias || '-',
          (wallet.tags || []).join(', ') || '-',
          wallet.is_active ? chalk.green('✓') : chalk.red('✗'),
          new Date(wallet.created_at).toLocaleDateString()
        ])
      ];
      
      console.log(table(tableData));
      console.log(chalk.gray(`Total: ${data.length} wallets`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch wallets'));
      console.error(error);
      process.exit(1);
    }
  });

walletCommand
  .command('add <address>')
  .description('Add a new wallet to track')
  .option('-n, --name <alias>', 'Set an alias for the wallet')
  .option('-t, --tags <tags>', 'Add tags (comma-separated)')
  .action(async (address, options) => {
    const spinner = ora('Adding wallet...').start();
    
    try {
      // Validate address format
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        throw new Error('Invalid Solana address format');
      }
      
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
      
      const { error } = await supabase.from('tracked_wallets').insert({
        address,
        alias: options.name,
        tags,
        is_active: true
      });
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Wallet already exists');
        }
        throw error;
      }
      
      spinner.succeed(chalk.green(`Wallet ${address} added successfully`));
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to add wallet: ${error.message}`));
      process.exit(1);
    }
  });

walletCommand
  .command('remove <address>')
  .description('Remove a wallet from tracking')
  .action(async (address) => {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove wallet ${address}?`,
        default: false
      }
    ]);
    
    if (!confirm) {
      console.log(chalk.yellow('Cancelled'));
      return;
    }
    
    const spinner = ora('Removing wallet...').start();
    
    try {
      const { error } = await supabase
        .from('tracked_wallets')
        .delete()
        .eq('address', address);
      
      if (error) throw error;
      
      spinner.succeed(chalk.green(`Wallet ${address} removed successfully`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to remove wallet'));
      console.error(error);
      process.exit(1);
    }
  });

walletCommand
  .command('toggle <address>')
  .description('Toggle wallet active/inactive status')
  .action(async (address) => {
    const spinner = ora('Updating wallet...').start();
    
    try {
      // Get current status
      const { data: wallet, error: fetchError } = await supabase
        .from('tracked_wallets')
        .select('is_active')
        .eq('address', address)
        .single();
      
      if (fetchError) throw fetchError;
      if (!wallet) throw new Error('Wallet not found');
      
      // Toggle status
      const { error: updateError } = await supabase
        .from('tracked_wallets')
        .update({ is_active: !wallet.is_active })
        .eq('address', address);
      
      if (updateError) throw updateError;
      
      spinner.succeed(
        chalk.green(`Wallet ${address} is now ${!wallet.is_active ? 'active' : 'inactive'}`)
      );
    } catch (error) {
      spinner.fail(chalk.red('Failed to update wallet'));
      console.error(error);
      process.exit(1);
    }
  });

walletCommand
  .command('import <file>')
  .description('Import wallets from a file (one address per line)')
  .action(async (file) => {
    const fs = await import('fs/promises');
    const spinner = ora('Importing wallets...').start();
    
    try {
      const content = await fs.readFile(file, 'utf-8');
      const addresses = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(line));
      
      if (addresses.length === 0) {
        throw new Error('No valid addresses found in file');
      }
      
      spinner.text = `Found ${addresses.length} addresses to import...`;
      
      const wallets = addresses.map(address => ({
        address,
        is_active: true,
        tags: ['imported']
      }));
      
      const { error } = await supabase
        .from('tracked_wallets')
        .upsert(wallets, { onConflict: 'address', ignoreDuplicates: true });
      
      if (error) throw error;
      
      spinner.succeed(chalk.green(`Successfully imported ${addresses.length} wallets`));
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed to import wallets: ${error.message}`));
      process.exit(1);
    }
  });