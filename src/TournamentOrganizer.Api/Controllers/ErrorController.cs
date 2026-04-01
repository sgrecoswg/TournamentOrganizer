using Microsoft.AspNetCore.Mvc;

namespace TournamentOrganizer.Api.Controllers;

[ApiController]
[ApiExplorerSettings(IgnoreApi = true)]
public class ErrorController : ControllerBase
{
    [Route("/error")]
    public IActionResult HandleError() =>
        Problem(title: "An unexpected error occurred.", statusCode: 500);
}
