using System.Security.Claims;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using TournamentOrganizer.Api.Controllers;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for path traversal guard in RemoveAvatar.
/// Written BEFORE implementation — they fail until the guard is in place.
/// </summary>
public class PlayerAvatarPathTraversalTests
{
    // ── Fake IPlayerService ──────────────────────────────────────────────

    private sealed class FakePlayerService : IPlayerService
    {
        private readonly Player? _player;
        public bool WasAvatarCleared { get; private set; }

        public FakePlayerService(string? avatarUrl)
        {
            _player = new Player { Id = 1, Name = "Alice", Email = "alice@test.com", AvatarUrl = avatarUrl };
        }

        public Task<Player?> GetByIdAsync(int id)
            => Task.FromResult(_player);

        public Task<PlayerDto> UpdateAvatarUrlAsync(int id, string? url)
        {
            WasAvatarCleared = url == null;
            var dto = new PlayerDto(1, "Alice", "alice@test.com", 25.0, 8.333, 0.0, false, 5, true, url);
            return Task.FromResult(dto);
        }

        public Task<bool> IsPlayerEmailAsync(int id, string? email) => Task.FromResult(true);
        public Task<bool> IsPlayerAtStoreAsync(int playerId, int storeId) => Task.FromResult(false);

        // No-op stubs for the rest
        public Task<PlayerDto> RegisterAsync(CreatePlayerDto dto) => throw new NotImplementedException();
        public Task<List<PlayerDto>> GetAllAsync() => throw new NotImplementedException();
        public Task<List<LeaderboardEntryDto>> GetLeaderboardAsync() => throw new NotImplementedException();
        public Task<PlayerDto?> UpdateAsync(int id, UpdatePlayerDto dto) => throw new NotImplementedException();
        public Task<PlayerProfileDto?> GetProfileAsync(int id) => throw new NotImplementedException();
        public Task<List<HeadToHeadEntryDto>?> GetHeadToHeadAsync(int playerId) => throw new NotImplementedException();
        public Task<PlayerCommanderStatsDto?> GetCommanderStatsAsync(int playerId) => throw new NotImplementedException();
        public Task<RatingHistoryDto?> GetRatingHistoryAsync(int playerId) => throw new NotImplementedException();
    }

    private sealed class StubBadgeService : IBadgeService
    {
        public Task CheckAndAwardAsync(int playerId, BadgeTrigger trigger, int? eventId = null) => Task.CompletedTask;
        public Task<List<PlayerBadgeDto>> GetBadgesAsync(int playerId) => Task.FromResult(new List<PlayerBadgeDto>());
    }

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = "";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "TournamentOrganizer";
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
        public IFileProvider WebRootFileProvider { get; set; } = null!;
    }

    private static PlayersController BuildController(
        IPlayerService service,
        IWebHostEnvironment env)
    {
        var controller = new PlayersController(service, env, new StubBadgeService(), Microsoft.Extensions.Logging.Abstractions.NullLogger<PlayersController>.Instance);
        var claims = new List<Claim>
        {
            new(ClaimTypes.Email, "alice@test.com"),
            new("email", "alice@test.com"),
            new("role", "Administrator")
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"))
            }
        };
        return controller;
    }

    // ── Tests ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("../../appsettings.json")]
    [InlineData("../../../secret.txt")]
    [InlineData("avatars/../../appsettings.json")]
    public async Task RemoveAvatar_TraversalPath_ReturnsBadRequest(string maliciousAvatarUrl)
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        Directory.CreateDirectory(Path.Combine(tempRoot, "avatars"));

        var env = new FakeWebHostEnvironment { WebRootPath = tempRoot };
        var service = new FakePlayerService(maliciousAvatarUrl);
        var controller = BuildController(service, env);

        var result = await controller.RemoveAvatar(1);

        Assert.IsType<BadRequestObjectResult>(result.Result);

        Directory.Delete(tempRoot, recursive: true);
    }

    [Fact]
    public async Task RemoveAvatar_LegitimateAvatarUrl_DeletesFileAndReturnsOk()
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        var avatarsDir = Path.Combine(tempRoot, "avatars");
        Directory.CreateDirectory(avatarsDir);

        var fakeAvatar = Path.Combine(avatarsDir, "1.png");
        await File.WriteAllBytesAsync(fakeAvatar, [0x89, 0x50]);

        var env = new FakeWebHostEnvironment { WebRootPath = tempRoot };
        var service = new FakePlayerService("/avatars/1.png");
        var controller = BuildController(service, env);

        var result = await controller.RemoveAvatar(1);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.False(File.Exists(fakeAvatar), "File should have been deleted");
        Assert.True(service.WasAvatarCleared);

        Directory.Delete(tempRoot, recursive: true);
    }

    [Fact]
    public async Task RemoveAvatar_NullAvatarUrl_ReturnsOkWithoutFileDeletion()
    {
        var env = new FakeWebHostEnvironment { WebRootPath = Path.GetTempPath() };
        var service = new FakePlayerService(null);
        var controller = BuildController(service, env);

        var result = await controller.RemoveAvatar(1);

        Assert.IsType<OkObjectResult>(result.Result);
    }
}
