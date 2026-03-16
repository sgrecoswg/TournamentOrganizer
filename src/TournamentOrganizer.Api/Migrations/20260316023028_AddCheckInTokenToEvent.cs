using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCheckInTokenToEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CheckInToken",
                table: "Events",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            // Backfill existing rows with a unique token each
            migrationBuilder.Sql(
                "UPDATE Events SET CheckInToken = LOWER(REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', '')) WHERE CheckInToken = ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CheckInToken",
                table: "Events");
        }
    }
}
