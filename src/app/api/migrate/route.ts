import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

// GET - Check if database needs migration
export async function GET(request: NextRequest) {
  try {
    // Check if to_id column exists in challonge_tournaments
    const checkColumn = await executeQuery(`
      SHOW COLUMNS FROM challonge_tournaments LIKE 'to_id'
    `, []);

    const needsMigration = (checkColumn as any[]).length === 0;

    if (needsMigration) {
      // Run the migration
      try {
        await executeQuery(`
          ALTER TABLE challonge_tournaments 
          ADD COLUMN to_id INT NULL AFTER assigned_judge_ids,
          ADD INDEX idx_to_id (to_id),
          ADD FOREIGN KEY (to_id) REFERENCES users(user_id) ON DELETE SET NULL
        `, []);

        // Update existing tournaments to set to_id to the first admin user if available
        await executeQuery(`
          UPDATE challonge_tournaments ct
          SET ct.to_id = (
              SELECT u.user_id 
              FROM users u 
              WHERE u.user_role = 'admin' 
              LIMIT 1
          )
          WHERE ct.to_id IS NULL
        `, []);

        return NextResponse.json({
          success: true,
          message: 'Database migration completed successfully',
          migrationRun: true
        });
      } catch (migrationError) {
        console.error('Migration error:', migrationError);
        return NextResponse.json({
          success: false,
          error: 'Migration failed: ' + (migrationError as Error).message,
          migrationRun: false
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        success: true,
        message: 'Database is up to date',
        migrationRun: false
      });
    }

  } catch (error) {
    console.error('Migration check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration check failed: ' + (error as Error).message
    }, { status: 500 });
  }
}