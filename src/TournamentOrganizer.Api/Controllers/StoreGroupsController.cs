using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[Route("api/storegroups")]
[Authorize(Policy = "Administrator")]
public class StoreGroupsController : ControllerBase
{
    private readonly IStoreGroupService _service;

    public StoreGroupsController(IStoreGroupService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<List<StoreGroupDto>>> GetAll()
        => Ok(await _service.GetAllAsync());

    [HttpPost]
    public async Task<ActionResult<StoreGroupDto>> Create(CreateStoreGroupDto dto)
    {
        var group = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetAll), new { id = group.Id }, group);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StoreGroupDto>> Update(int id, UpdateStoreGroupDto dto)
    {
        var group = await _service.UpdateAsync(id, dto);
        return group == null ? NotFound() : Ok(group);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id}/stores/{storeId}")]
    public async Task<IActionResult> AssignStore(int id, int storeId)
    {
        await _service.AssignStoreAsync(id, storeId);
        return NoContent();
    }

    [HttpDelete("{id}/stores/{storeId}")]
    public async Task<IActionResult> UnassignStore(int id, int storeId)
    {
        await _service.UnassignStoreAsync(storeId);
        return NoContent();
    }
}
