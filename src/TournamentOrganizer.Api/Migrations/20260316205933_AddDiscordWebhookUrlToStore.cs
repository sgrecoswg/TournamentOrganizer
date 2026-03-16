using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDiscordWebhookUrlToStore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DiscordWebhookUrl",
                table: "Stores",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DiscordWebhookUrl",
                table: "Stores");
        }
    }
}
