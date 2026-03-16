using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddingStoreToEventMapping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StoreEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StoreId = table.Column<int>(type: "int", nullable: false),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StoreEvents_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StoreEvents_Stores_StoreId",
                        column: x => x.StoreId,
                        principalTable: "Stores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StoreEvents_EventId",
                table: "StoreEvents",
                column: "EventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StoreEvents_StoreId_EventId",
                table: "StoreEvents",
                columns: new[] { "StoreId", "EventId" },
                unique: true);

            // Seed: assign all existing events to store 1 (if store 1 exists)
            migrationBuilder.Sql(@"
                INSERT INTO StoreEvents (StoreId, EventId, IsActive)
                SELECT 1, e.Id, 1
                FROM Events e
                WHERE EXISTS (SELECT 1 FROM Stores WHERE Id = 1)
                  AND NOT EXISTS (SELECT 1 FROM StoreEvents se WHERE se.EventId = e.Id);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StoreEvents");
        }
    }
}
