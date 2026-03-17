using TournamentOrganizer.Api.DTOs;

namespace TournamentOrganizer.Api.Services.Interfaces;

public interface IEventTemplateService
{
    Task<List<EventTemplateDto>> GetByStoreAsync(int storeId);
    Task<EventTemplateDto> CreateAsync(int storeId, CreateEventTemplateDto dto);
    Task<EventTemplateDto?> UpdateAsync(int id, UpdateEventTemplateDto dto);
    Task<bool> DeleteAsync(int id);
}
