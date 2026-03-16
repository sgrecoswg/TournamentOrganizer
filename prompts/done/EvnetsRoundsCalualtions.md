## Event Rounds Calculations
***Task***
When we create an event, we want to suggest the number of rounds based on the max players. This should be adjustable though as we register users. The suggestions will be available when we close registration and know how many players we have. Below is a draft of the players/rounds system used
Number of Players                       Recommended Swiss Rounds             Typical Playoff/Cut
4 (Team/2HG only)                       2 (single-elimination, no Swiss)     None
5–8                                     3                                    None (single-elimination if desired)
9–16                                    4 (Limited with Draft in playoffs)   Top 8 (Limited Draft) / Top 4 (Other)
                                        5 (All other formats)
17–32                                   5                                    Top 8
33–64                                   6                                    Top 8
65–128                                  7                                    Top 16
129–226                                 8                                    Top 16
227–409                                 9                                    Top 16
410+                                    10                                   Top 16

***Notes:***
Byes Adjustment: Each player with a bye counts as more than one for calculating rounds:
1-round bye counts as 2 players
2-round byes count as 4 players
3-round byes count as 8 players

Playoff/Single-Elimination: Usually only the top 8 advance, but smaller events may only cut top 4.
Swiss Format: Each player plays the same number of rounds, facing opponents with similar win records, without repeating opponents if possible.
This chart is practical for planning tournament duration, determining the number of games each player can expect, and ensuring sufficient rounds for a fair ranking system.
Example:
20 players (Constructed tournament): Recommended 5 Swiss rounds, top 8 move to playoffs.
60 players: Recommended 6 Swiss rounds, top 8 for playoffs.
300 players: Recommended 9 Swiss rounds, top 8 for playoffs.
**Backend** (`src/TournamentOrganizer.Api/`):
- We will need to add a `Rounds Sturcture` property to the event that gets saved to the database.

**Frontend**: (`tournament-client/`)
- `tournament-client\src\app\features\events\event-list.component.spec.ts`
    - show how many are registerd and slots remaining on the `event-info` card
- `tournament-client\src\app\features\events\event-detail.component.ts`
    - show how many are registerd and slots remaining on the `event-header`
    - display a button that will show the round structure.
    - when starting an event, display the suggested rounds and if confirmed use that for the number of rounds we will run.
    - When running the event (in progress) we can only create a number of rounds selected.
