using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for EventTemplateService.
/// Written BEFORE implementation — they fail until the service and repository are in place.
/// </summary>
public class EventTemplateServiceTests
{
    // ── Fake repository ───────────────────────────────────────────────────────

    private sealed class FakeEventTemplateRepository : IEventTemplateRepository
    {
        private readonly List<EventTemplate> _templates = [];

        public Task<List<EventTemplate>> GetByStoreAsync(int storeId) =>
            Task.FromResult(_templates.Where(t => t.StoreId == storeId).ToList());

        public Task<EventTemplate> CreateAsync(EventTemplate template)
        {
            template.Id = _templates.Count + 1;
            _templates.Add(template);
            return Task.FromResult(template);
        }

        public Task<EventTemplate?> GetByIdAsync(int id) =>
            Task.FromResult(_templates.FirstOrDefault(t => t.Id == id));

        public Task UpdateAsync(EventTemplate template) => Task.CompletedTask;

        public Task DeleteAsync(EventTemplate template)
        {
            _templates.Remove(template);
            return Task.CompletedTask;
        }
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private static (EventTemplateService service, FakeEventTemplateRepository repo) Build()
    {
        var repo = new FakeEventTemplateRepository();
        return (new EventTemplateService(repo), repo);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByStoreAsync_ReturnsTemplatesForStore()
    {
        var (service, repo) = Build();
        await repo.CreateAsync(new EventTemplate { StoreId = 1, Name = "T1", Format = "Commander", MaxPlayers = 16, NumberOfRounds = 4 });
        await repo.CreateAsync(new EventTemplate { StoreId = 1, Name = "T2", Format = "Commander", MaxPlayers = 8,  NumberOfRounds = 3 });

        var result = await service.GetByStoreAsync(1);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, t => t.Name == "T1");
        Assert.Contains(result, t => t.Name == "T2");
    }

    [Fact]
    public async Task GetByStoreAsync_DoesNotReturnOtherStoreTemplates()
    {
        var (service, repo) = Build();
        await repo.CreateAsync(new EventTemplate { StoreId = 1, Name = "Store1 Template", Format = "Commander", MaxPlayers = 16, NumberOfRounds = 4 });
        await repo.CreateAsync(new EventTemplate { StoreId = 2, Name = "Store2 Template", Format = "Commander", MaxPlayers = 16, NumberOfRounds = 4 });

        var result = await service.GetByStoreAsync(1);

        Assert.Single(result);
        Assert.Equal("Store1 Template", result[0].Name);
    }

    [Fact]
    public async Task CreateAsync_CreatesAndReturnsDto()
    {
        var (service, _) = Build();
        var dto = new CreateEventTemplateDto("Friday Night Commander", "Weekly event", "Commander", 16, 4);

        var result = await service.CreateAsync(storeId: 5, dto);

        Assert.True(result.Id > 0);
        Assert.Equal(5, result.StoreId);
        Assert.Equal("Friday Night Commander", result.Name);
        Assert.Equal("Weekly event", result.Description);
        Assert.Equal("Commander", result.Format);
        Assert.Equal(16, result.MaxPlayers);
        Assert.Equal(4, result.NumberOfRounds);
    }

    [Fact]
    public async Task UpdateAsync_TemplateNotFound_ReturnsNull()
    {
        var (service, _) = Build();
        var dto = new UpdateEventTemplateDto("Updated", null, "Commander", 8, 3);

        var result = await service.UpdateAsync(id: 999, dto);

        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_RemovesTemplate_ReturnsTrue()
    {
        var (service, repo) = Build();
        await repo.CreateAsync(new EventTemplate { StoreId = 1, Name = "To Delete", Format = "Commander", MaxPlayers = 16, NumberOfRounds = 4 });

        var result = await service.DeleteAsync(id: 1);

        Assert.True(result);
        Assert.Empty(await repo.GetByStoreAsync(1));
    }

    [Fact]
    public async Task DeleteAsync_NotFound_ReturnsFalse()
    {
        var (service, _) = Build();

        var result = await service.DeleteAsync(id: 999);

        Assert.False(result);
    }
}
