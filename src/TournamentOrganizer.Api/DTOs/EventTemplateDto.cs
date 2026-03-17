namespace TournamentOrganizer.Api.DTOs;

public record EventTemplateDto(int Id, int StoreId, string Name, string? Description, string Format, int MaxPlayers, int NumberOfRounds);
public record CreateEventTemplateDto(string Name, string? Description, string Format, int MaxPlayers, int NumberOfRounds);
public record UpdateEventTemplateDto(string Name, string? Description, string Format, int MaxPlayers, int NumberOfRounds);
