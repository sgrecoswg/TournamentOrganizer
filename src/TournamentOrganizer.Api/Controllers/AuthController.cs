using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string RefreshCookieName = "refresh_token";

    private readonly IAuthService _authService;
    private readonly IRefreshTokenRepository _refreshTokenRepo;
    private readonly IConfiguration _configuration;

    public AuthController(
        IAuthService authService,
        IRefreshTokenRepository refreshTokenRepo,
        IConfiguration configuration)
    {
        _authService = authService;
        _refreshTokenRepo = refreshTokenRepo;
        _configuration = configuration;
    }

    [HttpGet("google-login")]
    public IActionResult GoogleLogin()
    {
        var props = new AuthenticationProperties { RedirectUri = "/api/auth/google-callback" };
        return Challenge(props, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("google-callback")]
    public async Task<IActionResult> GoogleCallback()
    {
        var frontendBase = _configuration["Frontend:BaseUrl"] ?? "http://localhost:4200";

        var result = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (!result.Succeeded)
            return Redirect($"{frontendBase}/auth/callback?error=auth_failed");

        var email    = result.Principal!.FindFirstValue(ClaimTypes.Email);
        var name     = result.Principal.FindFirstValue(ClaimTypes.Name);
        var googleId = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier);

        if (email == null || googleId == null)
            return Redirect($"{frontendBase}/auth/callback?error=missing_claims");

        var user = await _authService.FindOrCreateUserAsync(email, name ?? email, googleId);
        var token = await _authService.GenerateJwtAsync(user);

        var refreshToken = await _authService.GenerateRefreshTokenAsync(user.Id);
        Response.Cookies.Append(RefreshCookieName, refreshToken.Token, new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.Strict,
            Expires  = refreshToken.ExpiresAt,
        });

        return Redirect($"{frontendBase}/auth/callback#token={Uri.EscapeDataString(token)}");
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) || rawToken == null)
            return Unauthorized();

        var result = await _authService.RefreshAsync(rawToken);
        if (result == null)
            return Unauthorized();

        var (jwt, newRefreshToken) = result.Value;
        Response.Cookies.Append(RefreshCookieName, newRefreshToken.Token, new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.Strict,
            Expires  = newRefreshToken.ExpiresAt,
        });

        return Ok(new { token = jwt });
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        if (Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) && rawToken != null)
        {
            var token = await _refreshTokenRepo.GetByTokenAsync(rawToken);
            if (token != null)
                await _refreshTokenRepo.RevokeAsync(token);
        }
        Response.Cookies.Delete(RefreshCookieName);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var id = int.Parse(User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub) ?? "0");
        var email = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email) ?? "";
        var name = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Name) ?? "";
        var role = User.FindFirstValue("role") ?? "Player";
        var playerIdStr = User.FindFirstValue("playerId");
        var storeIdStr = User.FindFirstValue("storeId");

        int? playerId = playerIdStr != null ? int.Parse(playerIdStr) : null;
        int? storeId = storeIdStr != null ? int.Parse(storeIdStr) : null;

        return Ok(new CurrentUserDto(id, email, name, role, playerId, storeId));
    }
}
