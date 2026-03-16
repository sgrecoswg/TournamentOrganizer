## Getting Commander(s) from a deckilst

**Frontend**: (`tournament-client/`)
-When Decklist is submitted in a event registration (sample `https://moxfield.com/decks/JHjwO92ZUEyNdPzE7D5d7A`), we want to know what card(s) are the commander(s)

Display the commander(s) in the 
- `tournament-client\src\app\features\player-profile\player-profile.component.ts` event history section ~line 133
component.ts` ~line 159
- `tournament-client\src\app\features\events\event-detail.component.ts` Players tab after the declist url ~line 108

- remove the game history from the `tournament-client\src\app\features\player-profile\player-profile`.

