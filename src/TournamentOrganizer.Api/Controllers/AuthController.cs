using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService) => _authService = authService;

    [HttpGet("google-login")]
    public IActionResult GoogleLogin()
    {
        var props = new AuthenticationProperties { RedirectUri = "/api/auth/google-callback" };
        return Challenge(props, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("google-callback")]
    public async Task<IActionResult> GoogleCallback()
    {
        var result = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (!result.Succeeded)
            return Redirect("http://localhost:4200/auth/callback?error=auth_failed");

        var email = result.Principal!.FindFirstValue(ClaimTypes.Email);
        var name = result.Principal.FindFirstValue(ClaimTypes.Name);
        var googleId = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier);

        if (email == null || googleId == null)
            return Redirect("http://localhost:4200/auth/callback?error=missing_claims");

        var user = await _authService.FindOrCreateUserAsync(email, name ?? email, googleId);
        var token = _authService.GenerateJwt(user);

        return Redirect($"http://localhost:4200/auth/callback?token={token}");
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
