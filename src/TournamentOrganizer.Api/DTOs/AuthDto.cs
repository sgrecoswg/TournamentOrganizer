namespace TournamentOrganizer.Api.DTOs;

public record CurrentUserDto(
    int Id,
    string Email,
    string Name,
    string Role,
    int? PlayerId,
    int? StoreId
);

public record AppUserDto(
    int Id,
    string Email,
    string Name,
    string Role,
    int? PlayerId,
    int? StoreId
);

public record AssignEmployeeDto
{
    public string Email { get; init; } = "";
    public string Name  { get; init; } = "";
    public string Role  { get; init; } = "";
}
