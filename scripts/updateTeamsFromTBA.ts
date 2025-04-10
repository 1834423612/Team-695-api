import axios from 'axios';
import readline from 'readline';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define TBA API interface
interface TBATeam {
    key: string;
    team_number: number;
    nickname: string;
    name: string;
    city: string;
    state_prov: string;
    country: string;
}

// Create interface for readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

// Function to fetch teams from TBA API
async function fetchTeamsFromTBA(eventKey: string): Promise<TBATeam[]> {
    try {
        const response = await axios.get(`https://www.thebluealliance.com/api/v3/event/${eventKey}/teams/simple`, {
            headers: {
                'X-TBA-Auth-Key': process.env.TBA_READ_API_KEY
            }
        });

        console.log(`Successfully retrieved ${response.data.length} teams from TBA for event ${eventKey}`);
        
        // Sort teams by team number in ascending order
        const sortedTeams = [...response.data].sort((a, b) => a.team_number - b.team_number);
        return sortedTeams;
    } catch (error: any) {
        if (error.response) {
            console.error(`Error ${error.response.status}: ${error.response.data.Error || 'Unknown error'}`);
        } else {
            console.error(`Error fetching teams from TBA: ${error.message}`);
        }
        return [];
    }
}

// Function to update teams in database
async function updateTeamsInDatabase(eventKey: string, teams: TBATeam[]): Promise<void> {
    let connection;

    try {
        // Connect to database
        connection = await mysql.createConnection(dbConfig);

        // Start transaction
        await connection.beginTransaction();

        // Process each team
        for (const team of teams) {
            // Check if team already exists in database
            const [existingTeam] = await connection.execute(
                'SELECT * FROM team_matches WHERE event_key = ? AND team_key = ?',
                [eventKey, team.key]
            );

            if (Array.isArray(existingTeam) && existingTeam.length > 0) {
                // Update existing team
                await connection.execute(
                    'UPDATE team_matches SET team_number = ?, nickname = ? WHERE event_key = ? AND team_key = ?',
                    [team.team_number, team.nickname || team.name, eventKey, team.key]
                );
            } else {
                // Insert new team
                await connection.execute(
                    'INSERT INTO team_matches (event_key, team_key, team_number, nickname, is_pit) VALUES (?, ?, ?, ?, ?)',
                    [eventKey, team.key, team.team_number, team.nickname || team.name, false]
                );
            }
        }

        // Commit transaction
        await connection.commit();

        console.log(`Successfully updated database with ${teams.length} teams for event ${eventKey}`);
    } catch (error) {
        // Rollback transaction on error
        if (connection) {
            await connection.rollback();
        }
        console.error('Error updating teams in database:', error);
    } finally {
        // Close database connection
        if (connection) {
            await connection.end();
        }
    }
}

// Main function
async function main() {
    try {
        // Prompt user for event key
        rl.question('Enter the event key (e.g., 2025ohcl): ', async (eventKey) => {
            if (!eventKey) {
                console.error('Event key is required');
                rl.close();
                return;
            }

            // Fetch teams from TBA API
            const teams = await fetchTeamsFromTBA(eventKey);

            if (teams.length === 0) {
                console.error('No teams found or error occurred');
                rl.close();
                return;
            }

            // Show preview of data (already sorted in fetchTeamsFromTBA)
            console.log('\nTeams to be updated (sorted by team number):');
            console.table(teams.slice(0, 5).map(team => ({
                team_number: team.team_number,
                nickname: team.nickname || team.name,
                location: `${team.city}, ${team.state_prov}, ${team.country}`
            })));

            if (teams.length > 5) {
                console.log(`...and ${teams.length - 5} more teams`);
            }

            // Ask for confirmation
            rl.question('\nDo you want to update the database with this data? (y/n): ', async (answer) => {
                if (answer.toLowerCase() === 'y') {
                    await updateTeamsInDatabase(eventKey, teams);
                    console.log('Database update completed');
                } else {
                    console.log('Database update cancelled');
                }
                rl.close();
            });
        });
    } catch (error) {
        console.error('Error in main function:', error);
        rl.close();
    }
}

// Run the script
main();
