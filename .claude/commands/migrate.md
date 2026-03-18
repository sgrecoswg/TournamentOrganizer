Create and apply an EF Core migration for the TournamentOrganizer API.

1. Ask the user for a migration name if not provided as an argument: $ARGUMENTS
2. Run `dotnet ef migrations add <name>` in `src/TournamentOrganizer.Api/`
3. If successful, ask the user if they want to apply it with `dotnet ef database update`
4. Report the result
