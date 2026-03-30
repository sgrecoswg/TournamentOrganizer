using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/stores/{storeId:int}/analytics")]
[Authorize(Policy = "Tier3Required")]
public class StoreAnalyticsController : ControllerBase
{
    private readonly IStoreAnalyticsService _service;

    public StoreAnalyticsController(IStoreAnalyticsService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<StoreAnalyticsDto>> Get(int storeId)
    {
        var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : 0;
        if (!User.HasClaim("role", "Administrator") && jwtStoreId != storeId)
            return Forbid();

        var result = await _service.GetAnalyticsAsync(storeId);
        return Ok(result);
    }
}
