using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/themes")]
public class ThemesController : ControllerBase
{
    private readonly IThemeService _service;

    public ThemesController(IThemeService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());
}
