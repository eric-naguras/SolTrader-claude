import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getSupabaseClient } from '@sonar/database';

const supabase = getSupabaseClient();

export const signalCommand = new Command('signal')
  .description('View and manage trade signals');

signalCommand
  .command('list')
  .description('List recent trade signals')
  .option('-l, --limit <number>', 'Number of signals to show', '10')
  .option('-s, --status <status>', 'Filter by status (OPEN, EXECUTED, EXPIRED)')
  .action(async (options) => {
    const spinner = ora('Fetching signals...').start();
    
    try {
      let query = supabase
        .from('trade_signals')
        .select('*, tokens(symbol, name)')
        .order('created_at', { ascending: false })
        .limit(parseInt(options.limit));
      
      if (options.status) {
        query = query.eq('status', options.status.toUpperCase());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      spinner.stop();
      
      if (!data || data.length === 0) {
        console.log(chalk.yellow('No signals found'));
        return;
      }
      
      const tableData = [
        ['Time', 'Token', 'Status', 'Whales', 'Confidence', 'Reason'],
        ...data.map(signal => [
          new Date(signal.created_at).toLocaleString(),
          signal.tokens?.symbol || signal.coin_address.slice(0, 8) + '...',
          signal.status === 'OPEN' ? chalk.green(signal.status) :
          signal.status === 'EXECUTED' ? chalk.blue(signal.status) :
          chalk.gray(signal.status),
          signal.metadata?.whale_count || '-',
          signal.metadata?.confidence ? `${(signal.metadata.confidence * 100).toFixed(0)}%` : '-',
          signal.trigger_reason || '-'
        ])
      ];
      
      console.log(table(tableData));
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch signals'));
      console.error(error);
      process.exit(1);
    }
  });

signalCommand
  .command('config')
  .description('View or update signal configuration')
  .option('-w, --whales <number>', 'Minimum number of whales required')
  .option('-t, --time <hours>', 'Time window in hours')
  .option('-a, --amount <sol>', 'Minimum trade amount in SOL')
  .action(async (options) => {
    const hasUpdates = options.whales || options.time || options.amount;
    
    if (hasUpdates) {
      const spinner = ora('Updating configuration...').start();
      
      try {
        const updates: any = {};
        if (options.whales) updates.min_whales = parseInt(options.whales);
        if (options.time) updates.time_window_hours = parseInt(options.time);
        if (options.amount) updates.min_trade_amount_sol = parseFloat(options.amount);
        
        const { error } = await supabase
          .from('signal_config')
          .insert(updates);
        
        if (error) throw error;
        
        spinner.succeed(chalk.green('Configuration updated successfully'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to update configuration'));
        console.error(error);
        process.exit(1);
      }
    }
    
    // Show current config
    const spinner = ora('Fetching configuration...').start();
    
    try {
      const { data, error } = await supabase
        .from('signal_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      
      spinner.stop();
      
      console.log(chalk.bold('\nCurrent Signal Configuration:'));
      console.log(`  Minimum whales: ${chalk.cyan(data.min_whales)}`);
      console.log(`  Time window: ${chalk.cyan(data.time_window_hours)} hour(s)`);
      console.log(`  Minimum trade amount: ${chalk.cyan(data.min_trade_amount_sol)} SOL`);
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch configuration'));
      console.error(error);
      process.exit(1);
    }
  });