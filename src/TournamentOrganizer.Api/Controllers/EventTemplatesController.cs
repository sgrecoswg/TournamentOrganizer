using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;
using System.Security.Claims;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/stores/{storeId}/eventtemplates")]
public class EventTemplatesController : ControllerBase
{
    private readonly IEventTemplateService _service;

    public EventTemplatesController(IEventTemplateService service) => _service = service;

    [HttpGet]
    [Authorize(Policy = "StoreEmployee")]
    public async Task<ActionResult<List<EventTemplateDto>>> GetAll(int storeId)
    {
        if (!UserCanAccessStore(storeId)) return Forbid();
        return Ok(await _service.GetByStoreAsync(storeId));
    }

    [HttpPost]
    [Authorize(Policy = "StoreManager")]
    public async Task<ActionResult<EventTemplateDto>> Create(int storeId, CreateEventTemplateDto dto)
    {
        if (!UserCanAccessStore(storeId)) return Forbid();
        var created = await _service.CreateAsync(storeId, dto);
        return CreatedAtAction(nameof(GetAll), new { storeId }, created);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = "StoreManager")]
    public async Task<ActionResult<EventTemplateDto>> Update(int storeId, int id, UpdateEventTemplateDto dto)
    {
        if (!UserCanAccessStore(storeId)) return Forbid();
        var result = await _service.UpdateAsync(id, dto);
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "StoreManager")]
    public async Task<IActionResult> Delete(int storeId, int id)
    {
        if (!UserCanAccessStore(storeId)) return Forbid();
        var deleted = await _service.DeleteAsync(id);
        if (!deleted) return NotFound();
        return Ok(new { message = "Template deleted" });
    }

    private bool UserCanAccessStore(int storeId)
    {
        if (User.HasClaim("role", "Administrator")) return true;
        var jwtStoreId = int.TryParse(User.FindFirstValue("storeId"), out var s) ? s : (int?)null;
        return jwtStoreId == storeId;
    }
}
