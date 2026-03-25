namespace TournamentOrganizer.Api.DTOs;

public record NotificationDto(int Id, string Type, string Message, string? LinkPath, bool IsRead, DateTime CreatedAt);
public record NotificationCountDto(int Unread);
