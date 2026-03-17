using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class EventTemplateService : IEventTemplateService
{
    private readonly IEventTemplateRepository _repo;

    public EventTemplateService(IEventTemplateRepository repo) => _repo = repo;

    public async Task<List<EventTemplateDto>> GetByStoreAsync(int storeId)
    {
        var templates = await _repo.GetByStoreAsync(storeId);
        return templates.Select(ToDto).ToList();
    }

    public async Task<EventTemplateDto> CreateAsync(int storeId, CreateEventTemplateDto dto)
    {
        var template = new EventTemplate
        {
            StoreId       = storeId,
            Name          = dto.Name,
            Description   = dto.Description,
            Format        = dto.Format,
            MaxPlayers    = dto.MaxPlayers,
            NumberOfRounds = dto.NumberOfRounds,
        };
        var created = await _repo.CreateAsync(template);
        return ToDto(created);
    }

    public async Task<EventTemplateDto?> UpdateAsync(int id, UpdateEventTemplateDto dto)
    {
        var template = await _repo.GetByIdAsync(id);
        if (template is null) return null;

        template.Name          = dto.Name;
        template.Description   = dto.Description;
        template.Format        = dto.Format;
        template.MaxPlayers    = dto.MaxPlayers;
        template.NumberOfRounds = dto.NumberOfRounds;

        await _repo.UpdateAsync(template);
        return ToDto(template);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var template = await _repo.GetByIdAsync(id);
        if (template is null) return false;

        await _repo.DeleteAsync(template);
        return true;
    }

    private static EventTemplateDto ToDto(EventTemplate t) =>
        new(t.Id, t.StoreId, t.Name, t.Description, t.Format, t.MaxPlayers, t.NumberOfRounds);
}
