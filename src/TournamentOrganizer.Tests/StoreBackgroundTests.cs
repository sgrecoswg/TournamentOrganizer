using System.Security.Claims;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.Controllers;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the store background image upload endpoint.
/// Written BEFORE implementation — they fail until the controller action is in place.
/// </summary>
public class StoreBackgroundTests
{
    // ── Fake IStoresService ──────────────────────────────────────────────

    private sealed class FakeStoresService : IStoresService
    {
        public string? LastBackgroundUrl { get; private set; }
        public int LastBackgroundStoreId { get; private set; }

        private readonly StoreDto _storeDto;

        public FakeStoresService(StoreDto storeDto) => _storeDto = storeDto;

        public Task<StoreDto> UpdateBackgroundImageUrlAsync(int storeId, string? backgroundImageUrl)
        {
            LastBackgroundStoreId = storeId;
            LastBackgroundUrl = backgroundImageUrl;
            var updated = _storeDto with { BackgroundImageUrl = backgroundImageUrl };
            return Task.FromResult(updated);
        }

        public Task<StoreDto> UpdateLogoUrlAsync(int storeId, string? logoUrl) => throw new NotImplementedException();
        public Task<List<StoreDto>> GetAllAsync() => throw new NotImplementedException();
        public Task<StoreDetailDto?> GetByIdAsync(int id) => throw new NotImplementedException();
        public Task<StoreDto> CreateAsync(CreateStoreDto dto) => throw new NotImplementedException();
        public Task<StoreDetailDto?> UpdateAsync(int id, UpdateStoreDto dto) => throw new NotImplementedException();
        public Task<StorePublicDto?> GetPublicPageAsync(string slug) => throw new NotImplementedException();
    }

    private sealed class StubCommanderMetaService : ICommanderMetaService
    {
        public Task<CommanderMetaReportDto> GetStoreMetaAsync(int storeId, string period) =>
            Task.FromResult(new CommanderMetaReportDto(storeId, period, [], new Dictionary<string, int>()));
    }

    private sealed class StubDiscordWebhookService : IDiscordWebhookService
    {
        public Task PostRoundResultsAsync(int eventId, int roundNumber) => Task.CompletedTask;
        public Task PostEventCompletedAsync(int eventId) => Task.CompletedTask;
        public Task PostPlayerRankedAsync(int playerId, int eventId) => Task.CompletedTask;
        public Task PostTestMessageAsync(int storeId) => Task.CompletedTask;
    }

    private sealed class StubLicenseTierService : ILicenseTierService
    {
        public Task<TournamentOrganizer.Api.Models.LicenseTier> GetEffectiveTierAsync(int storeId)
            => Task.FromResult(TournamentOrganizer.Api.Models.LicenseTier.Tier2);
    }

    // ── Fake IWebHostEnvironment ─────────────────────────────────────────

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = Path.GetTempPath();
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public string EnvironmentName { get; set; } = "Testing";
        public string ApplicationName { get; set; } = "TournamentOrganizer";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
    }

    // ── Fake IFormFile ───────────────────────────────────────────────────

    private static IFormFile MakeFormFile(string fileName, long sizeBytes, string contentType = "image/png")
    {
        var content = new byte[sizeBytes];
        var stream = new MemoryStream(content);
        var formFile = new FormFile(stream, 0, sizeBytes, "background", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
        return formFile;
    }

    // ── Helper: build controller with fake user claims ────────────────────

    private static StoresController BuildController(
        IStoresService service,
        IWebHostEnvironment env,
        bool isAdmin = false,
        int jwtStoreId = 1)
    {
        var controller = new StoresController(service, env, new StubCommanderMetaService(), new StubDiscordWebhookService(), new StubLicenseTierService());
        var claims = new List<Claim>
        {
            new("sub", "user-1"),
            new("storeId", jwtStoreId.ToString())
        };
        if (isAdmin) claims.Add(new Claim("role", "Administrator"));
        else claims.Add(new Claim("role", "StoreManager"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"))
            }
        };
        return controller;
    }

    // ── Tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task UploadBackground_ValidFile_SavesUrlAndReturnsDto()
    {
        var env = new FakeWebHostEnvironment();
        var storeDto = new StoreDto(1, "Test Store", true);
        var service = new FakeStoresService(storeDto);
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("background.png", 512 * 1024); // 512 KB
        var result = await controller.UploadBackground(1, file);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsType<StoreDto>(ok.Value);
        Assert.Equal("/backgrounds/1.png", returned.BackgroundImageUrl);
        Assert.Equal(1, service.LastBackgroundStoreId);
        Assert.Equal("/backgrounds/1.png", service.LastBackgroundUrl);
    }

    [Fact]
    public async Task UploadBackground_InvalidExtension_Returns400()
    {
        var env = new FakeWebHostEnvironment();
        var service = new FakeStoresService(new StoreDto(1, "Test Store", true));
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("background.bmp", 100, "image/bmp");
        var result = await controller.UploadBackground(1, file);

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(bad.Value);
    }

    [Fact]
    public async Task UploadBackground_FileTooLarge_Returns400()
    {
        var env = new FakeWebHostEnvironment();
        var service = new FakeStoresService(new StoreDto(1, "Test Store", true));
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("background.jpg", 6 * 1024 * 1024); // 6 MB > 5 MB limit
        var result = await controller.UploadBackground(1, file);

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(bad.Value);
    }

    [Fact]
    public async Task UploadBackground_ReplacesExistingBackground()
    {
        var env = new FakeWebHostEnvironment();
        // Pre-create a fake existing background file so the controller can overwrite it
        var bgDir = Path.Combine(env.WebRootPath, "backgrounds");
        Directory.CreateDirectory(bgDir);
        var existing = Path.Combine(bgDir, "1.png");
        await File.WriteAllBytesAsync(existing, new byte[100]);

        var storeDto = new StoreDto(1, "Test Store", true, BackgroundImageUrl: "/backgrounds/1.png");
        var service = new FakeStoresService(storeDto);
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("new-background.png", 200 * 1024);
        var result = await controller.UploadBackground(1, file);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsType<StoreDto>(ok.Value);
        Assert.Equal("/backgrounds/1.png", returned.BackgroundImageUrl);

        // Clean up
        if (File.Exists(existing)) File.Delete(existing);
    }
}
