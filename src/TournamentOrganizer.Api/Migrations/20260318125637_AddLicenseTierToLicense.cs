using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLicenseTierToLicense : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add column with default 0 (Free) first, then update existing rows to Tier2 (2)
            // This ensures existing active licenses are backwards-compatible (Tier2 = full access)
            migrationBuilder.AddColumn<int>(
                name: "Tier",
                table: "Licenses",
                type: "int",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.Sql("UPDATE Licenses SET Tier = 2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Tier",
                table: "Licenses");
        }
    }
}
