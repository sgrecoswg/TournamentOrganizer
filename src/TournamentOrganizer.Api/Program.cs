using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services;
using TournamentOrganizer.Api.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication — Cookie (OAuth dance) + Google + JWT (API access)
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultSignInScheme       = CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddCookie()
.AddGoogle(options =>
{
    options.ClientId     = builder.Configuration["Google:ClientId"]!;
    options.ClientSecret = builder.Configuration["Google:ClientSecret"]!;
    options.CallbackPath = "/signin-google";
})
.AddJwtBearer(options =>
{
    // Keep claim names as written in the JWT (e.g. "role", "storeId", "playerId").
    // Without this, the runtime remaps "role" → ClaimTypes.Role (full URI), breaking
    // all HasClaim("role", ...) checks in policies and controllers.
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey         = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
        ValidateIssuer   = true,
        ValidIssuer      = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience    = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("StoreEmployee", p => p.RequireAssertion(ctx =>
        ctx.User.HasClaim("role", "StoreEmployee") ||
        ctx.User.HasClaim("role", "StoreManager")  ||
        ctx.User.HasClaim("role", "Administrator")));
    options.AddPolicy("StoreManager", p => p.RequireAssertion(ctx =>
        ctx.User.HasClaim("role", "StoreManager") ||
        ctx.User.HasClaim("role", "Administrator")));
    options.AddPolicy("Administrator", p =>
        p.RequireClaim("role", "Administrator"));
    options.AddPolicy("Tier1Required", p => p.RequireAssertion(ctx =>
        ctx.User.HasClaim("role", "Administrator") ||
        TierAtLeast(ctx.User, LicenseTier.Tier1)));
    options.AddPolicy("Tier2Required", p => p.RequireAssertion(ctx =>
        ctx.User.HasClaim("role", "Administrator") ||
        TierAtLeast(ctx.User, LicenseTier.Tier2)));
});

static bool TierAtLeast(ClaimsPrincipal user, LicenseTier required)
{
    var raw = user.FindFirstValue("licenseTier");
    return Enum.TryParse<LicenseTier>(raw, out var t) && t >= required;
}

// Repositories
builder.Services.AddScoped<IPlayerRepository, PlayerRepository>();
builder.Services.AddScoped<IEventRepository, EventRepository>();
builder.Services.AddScoped<IGameRepository, GameRepository>();
builder.Services.AddScoped<IWishlistRepository, WishlistRepository>();
builder.Services.AddScoped<ITradeRepository, TradeRepository>();
builder.Services.AddScoped<IStoreRepository, StoreRepository>();
builder.Services.AddScoped<IStoreGroupRepository, StoreGroupRepository>();
builder.Services.AddScoped<IStoreSettingsRepository, StoreSettingsRepository>();
builder.Services.AddScoped<IStoreEventRepository, StoreEventRepository>();
builder.Services.AddScoped<ILicenseRepository, LicenseRepository>();
builder.Services.AddScoped<IThemeRepository, ThemeRepository>();
builder.Services.AddScoped<IEventTemplateRepository, EventTemplateRepository>();
builder.Services.AddScoped<IBadgeRepository, BadgeRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();

// Services
builder.Services.AddScoped<ITrueSkillService, TrueSkillService>();
builder.Services.AddScoped<IPodService, PodService>();
builder.Services.AddScoped<IPlayerService, PlayerService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IWishlistService, WishlistService>();
builder.Services.AddScoped<ITradeService, TradeService>();
builder.Services.AddScoped<IStoresService, StoresService>();
builder.Services.AddScoped<IStoreGroupService, StoreGroupService>();
builder.Services.AddScoped<IThemeService, ThemeService>();
builder.Services.AddScoped<ISuggestedTradeService, SuggestedTradeService>();
builder.Services.AddScoped<ICommanderMetaService, CommanderMetaService>();
builder.Services.AddScoped<IDiscordWebhookService, DiscordWebhookService>();
builder.Services.AddScoped<IEventTemplateService, EventTemplateService>();
builder.Services.AddScoped<IAppUserRepository, AppUserRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ILicenseTierService, LicenseTierService>();
builder.Services.AddScoped<IBadgeService, BadgeService>();
builder.Services.AddScoped<INotificationService, NotificationService>();

// Card price (Scryfall) — typed HttpClient with 1h in-memory cache
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<ICardPriceService, CardPriceService>(client =>
{
    client.BaseAddress = new Uri("https://api.scryfall.com/");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("TournamentOrganizer/1.0");
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Discord webhook — named HttpClient (fire-and-forget, 10s timeout)
builder.Services.AddHttpClient("Discord", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Moxfield — named HttpClient used by DecklistController (24h cache handled in controller)
builder.Services.AddHttpClient("Moxfield", client =>
{
    client.BaseAddress = new Uri("https://api2.moxfield.com/");
    client.DefaultRequestHeaders.Add("User-Agent", "PostmanRuntime/7.51.1");
    //client.DefaultRequestHeaders.UserAgent.ParseAdd(
    //    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json, text/plain, */*");
    client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
    client.Timeout = TimeSpan.FromSeconds(20);
});

// Controllers + Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS for future Angular frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

// Serve wwwroot regardless of whether the directory existed at startup.
// WebRootPath is null when wwwroot doesn't exist yet, which makes the default
// UseStaticFiles() use a NullFileProvider. We compute the path explicitly so
// uploads on first run are served immediately without a restart.
var wwwrootPath = app.Environment.WebRootPath
    ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);
app.UseStaticFiles(new Microsoft.AspNetCore.Builder.StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath)
});

var avatarsPath = Path.Combine(wwwrootPath, "avatars");
Directory.CreateDirectory(avatarsPath);
app.UseStaticFiles(new Microsoft.AspNetCore.Builder.StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(avatarsPath),
    RequestPath  = "/avatars"
});

var backgroundsPath = Path.Combine(wwwrootPath, "backgrounds");
Directory.CreateDirectory(backgroundsPath);
app.UseStaticFiles(new Microsoft.AspNetCore.Builder.StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(backgroundsPath),
    RequestPath  = "/backgrounds"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Expose Program to WebApplicationFactory in integration tests
public partial class Program { }
