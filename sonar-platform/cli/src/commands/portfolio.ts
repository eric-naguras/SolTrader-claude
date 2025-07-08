import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getSupabaseClient, createPortfolioTrade } from '@sonar/database';

const supabase = getSupabaseClient();

export const portfolioCommand = new Command('portfolio')
  .description('Manage and view portfolio trades');

portfolioCommand
  .command('list')
  .description('List portfolio trades')
  .option('-m, --mode <mode>', 'Filter by mode (PAPER, LIVE)')
  .option('-s, --status <status>', 'Filter by status (OPEN, CLOSED)')
  .option('-l, --limit <number>', 'Number of trades to show', '20')
  .action(async (options) => {
    const spinner = ora('Fetching portfolio trades...').start();
    
    try {
      let query = supabase
        .from('portfolio_trades')
        .select('*, tokens(symbol, name), trade_signals(*)')
        .order('entry_timestamp', { ascending: false })
        .limit(parseInt(options.limit));
      
      if (options.mode) {
        query = query.eq('trade_mode', options.mode.toUpperCase());
      }
      if (options.status) {
        query = query.eq('status', options.status.toUpperCase());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      spinner.stop();
      
      if (!data || data.length === 0) {
        console.log(chalk.yellow('No trades found'));
        return;
      }
      
      // Calculate totals
      const openTrades = data.filter(t => t.status === 'OPEN').length;
      const closedTrades = data.filter(t => t.status === 'CLOSED').length;
      const totalPnL = data
        .filter(t => t.pnl_usd !== null)
        .reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
      
      const tableData = [
        ['Time', 'Token', 'Mode', 'Status', 'Entry', 'Exit', 'PnL', 'Reason'],
        ...data.map(trade => [
          trade.entry_timestamp 
            ? new Date(trade.entry_timestamp).toLocaleString() 
            : '-',
          trade.tokens?.symbol || trade.coin_address.slice(0, 8) + '...',
          trade.trade_mode === 'PAPER' ? chalk.yellow(trade.trade_mode) : chalk.green(trade.trade_mode),
          trade.status === 'OPEN' ? chalk.green(trade.status) : chalk.gray(trade.status),
          trade.entry_price ? `$${trade.entry_price.toFixed(6)}` : '-',
          trade.exit_price ? `$${trade.exit_price.toFixed(6)}` : '-',
          trade.pnl_usd !== null 
            ? trade.pnl_usd >= 0 
              ? chalk.green(`+$${trade.pnl_usd.toFixed(2)}`)
              : chalk.red(`-$${Math.abs(trade.pnl_usd).toFixed(2)}`)
            : '-',
          trade.exit_reason || '-'
        ])
      ];
      
      console.log(table(tableData));
      console.log(chalk.gray('\nSummary:'));
      console.log(chalk.gray(`  Open: ${openTrades} | Closed: ${closedTrades}`));
      console.log(chalk.gray(`  Total PnL: ${totalPnL >= 0 ? chalk.green(`+$${totalPnL.toFixed(2)}`) : chalk.red(`-$${Math.abs(totalPnL).toFixed(2)}`)}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch portfolio trades'));
      console.error(error);
      process.exit(1);
    }
  });

portfolioCommand
  .command('paper-trade')
  .description('Enable automatic paper trading for new signals')
  .action(async () => {
    console.log(chalk.cyan('Setting up paper trading listener...'));
    
    // Subscribe to new signals
    const subscription = supabase
      .channel('paper_trading')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_signals'
        },
        async (payload) => {
          const signal = payload.new as any;
          console.log(chalk.green(`\n✓ New signal detected for ${signal.coin_address}`));
          
          try {
            // Create paper trade
            await createPortfolioTrade({
              signal_id: signal.id,
              trade_mode: 'PAPER',
              coin_address: signal.coin_address,
              status: 'OPEN',
              entry_timestamp: new Date(),
              // In a real implementation, we would fetch the current price
              entry_price: 0.000001, // Placeholder
              high_water_mark_price: 0.000001
            });
            
            console.log(chalk.green('✓ Paper trade created'));
          } catch (error) {
            console.error(chalk.red('Failed to create paper trade:'), error);
          }
        }
      )
      .subscribe();
    
    console.log(chalk.cyan('Paper trading enabled. Press Ctrl+C to stop.'));
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nStopping paper trading...'));
      subscription.unsubscribe();
      process.exit(0);
    });
  });