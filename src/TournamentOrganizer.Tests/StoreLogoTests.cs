using System.Security.Claims;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.Controllers;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for the store logo upload endpoint.
/// Written BEFORE implementation — they fail until the controller action is in place.
/// </summary>
public class StoreLogoTests
{
    // ── Fake IStoresService ──────────────────────────────────────────────

    private sealed class FakeStoresService : IStoresService
    {
        public string? LastLogoUrl { get; private set; }
        public int LastLogoStoreId { get; private set; }

        private readonly StoreDto _storeDto;

        public FakeStoresService(StoreDto storeDto) => _storeDto = storeDto;

        public Task<StoreDto> UpdateLogoUrlAsync(int storeId, string? logoUrl)
        {
            LastLogoStoreId = storeId;
            LastLogoUrl = logoUrl;
            var updated = _storeDto with { LogoUrl = logoUrl };
            return Task.FromResult(updated);
        }

        public Task<List<StoreDto>> GetAllAsync() => throw new NotImplementedException();
        public Task<StoreDetailDto?> GetByIdAsync(int id) => throw new NotImplementedException();
        public Task<StoreDto> CreateAsync(CreateStoreDto dto) => throw new NotImplementedException();
        public Task<StoreDetailDto?> UpdateAsync(int id, UpdateStoreDto dto) => throw new NotImplementedException();
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
        var formFile = new FormFile(stream, 0, sizeBytes, "logo", fileName)
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
        var controller = new StoresController(service, env);
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
    public async Task UploadLogo_ValidFile_SavesUrlAndReturnsDto()
    {
        var env = new FakeWebHostEnvironment();
        var storeDto = new StoreDto(1, "Test Store", true);
        var service = new FakeStoresService(storeDto);
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("logo.png", 512 * 1024); // 512 KB
        var result = await controller.UploadLogo(1, file);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsType<StoreDto>(ok.Value);
        Assert.Equal("/logos/1.png", returned.LogoUrl);
        Assert.Equal(1, service.LastLogoStoreId);
        Assert.Equal("/logos/1.png", service.LastLogoUrl);
    }

    [Fact]
    public async Task UploadLogo_InvalidExtension_Returns400()
    {
        var env = new FakeWebHostEnvironment();
        var service = new FakeStoresService(new StoreDto(1, "Test Store", true));
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("logo.exe", 100, "application/octet-stream");
        var result = await controller.UploadLogo(1, file);

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(bad.Value);
    }

    [Fact]
    public async Task UploadLogo_FileTooLarge_Returns400()
    {
        var env = new FakeWebHostEnvironment();
        var service = new FakeStoresService(new StoreDto(1, "Test Store", true));
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("logo.jpg", 3 * 1024 * 1024); // 3 MB > 2 MB limit
        var result = await controller.UploadLogo(1, file);

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.NotNull(bad.Value);
    }

    [Fact]
    public async Task UploadLogo_ReplacesExistingLogo()
    {
        var env = new FakeWebHostEnvironment();
        // Pre-create a fake existing logo file so the controller can overwrite it
        var logosDir = Path.Combine(env.WebRootPath, "logos");
        Directory.CreateDirectory(logosDir);
        var existing = Path.Combine(logosDir, "1.png");
        await File.WriteAllBytesAsync(existing, new byte[100]);

        var storeDto = new StoreDto(1, "Test Store", true, "/logos/1.png");
        var service = new FakeStoresService(storeDto);
        var controller = BuildController(service, env, isAdmin: true);

        var file = MakeFormFile("new-logo.png", 200 * 1024);
        var result = await controller.UploadLogo(1, file);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsType<StoreDto>(ok.Value);
        Assert.Equal("/logos/1.png", returned.LogoUrl);

        // Clean up
        if (File.Exists(existing)) File.Delete(existing);
    }
}
