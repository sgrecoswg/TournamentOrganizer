using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for ThemeService.
/// Written BEFORE implementation to define expected behaviour.
/// </summary>
public class ThemesServiceTests
{
    // ── Fake repository ───────────────────────────────────────────────────

    private sealed class FakeThemeRepository : IThemeRepository
    {
        private readonly List<Theme> _themes;
        public FakeThemeRepository(List<Theme> themes) => _themes = themes;
        public Task<List<Theme>> GetAllAsync() => Task.FromResult(_themes.Where(t => t.IsActive).OrderBy(t => t.Id).ToList());
    }

    private static Theme MakeTheme(int id, string name, string cssClass, bool isActive = true) =>
        new() { Id = id, Name = name, CssClass = cssClass, IsActive = isActive };

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllAsync_ReturnsOnlyActiveThemes()
    {
        var themes = new List<Theme>
        {
            MakeTheme(1, "Default", "theme-default", isActive: true),
            MakeTheme(2, "Dark",    "theme-dark",    isActive: false),
            MakeTheme(3, "Forest",  "theme-forest",  isActive: true),
        };
        var service = new ThemeService(new FakeThemeRepository(themes));

        var result = await service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.DoesNotContain(result, t => t.Name == "Dark");
    }

    [Fact]
    public async Task GetAllAsync_MapsAllDtoFields()
    {
        var themes = new List<Theme>
        {
            MakeTheme(1, "Default", "theme-default"),
        };
        var service = new ThemeService(new FakeThemeRepository(themes));

        var result = await service.GetAllAsync();
        var dto = result.Single();

        Assert.Equal(1, dto.Id);
        Assert.Equal("Default", dto.Name);
        Assert.Equal("theme-default", dto.CssClass);
        Assert.True(dto.IsActive);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsEmptyListWhenNoActiveThemes()
    {
        var themes = new List<Theme>
        {
            MakeTheme(1, "Dark", "theme-dark", isActive: false),
        };
        var service = new ThemeService(new FakeThemeRepository(themes));

        var result = await service.GetAllAsync();

        Assert.Empty(result);
    }
}
