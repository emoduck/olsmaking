using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Olsmaking.Bff.Migrations
{
    /// <inheritdoc />
    public partial class AddBeerReviewDimensionScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_BeerReviews_Rating",
                table: "BeerReviews");

            migrationBuilder.RenameColumn(
                name: "Rating",
                table: "BeerReviews",
                newName: "TotalScore");

            migrationBuilder.AddColumn<int>(
                name: "ColorScore",
                table: "BeerReviews",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SmellScore",
                table: "BeerReviews",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TasteScore",
                table: "BeerReviews",
                type: "int",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE BeerReviews
                SET
                    TotalScore = CASE WHEN TotalScore BETWEEN 1 AND 6 THEN TotalScore ELSE 3 END,
                    ColorScore = CASE WHEN TotalScore BETWEEN 1 AND 6 THEN TotalScore ELSE 3 END,
                    SmellScore = CASE WHEN TotalScore BETWEEN 1 AND 6 THEN TotalScore ELSE 3 END,
                    TasteScore = CASE WHEN TotalScore BETWEEN 1 AND 6 THEN TotalScore ELSE 3 END
                """);

            migrationBuilder.AlterColumn<int>(
                name: "ColorScore",
                table: "BeerReviews",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "SmellScore",
                table: "BeerReviews",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TasteScore",
                table: "BeerReviews",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_BeerReviews_ColorScore",
                table: "BeerReviews",
                sql: "[ColorScore] >= 1 AND [ColorScore] <= 6");

            migrationBuilder.AddCheckConstraint(
                name: "CK_BeerReviews_SmellScore",
                table: "BeerReviews",
                sql: "[SmellScore] >= 1 AND [SmellScore] <= 6");

            migrationBuilder.AddCheckConstraint(
                name: "CK_BeerReviews_TasteScore",
                table: "BeerReviews",
                sql: "[TasteScore] >= 1 AND [TasteScore] <= 6");

            migrationBuilder.AddCheckConstraint(
                name: "CK_BeerReviews_TotalScore",
                table: "BeerReviews",
                sql: "[TotalScore] >= 1 AND [TotalScore] <= 6");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_BeerReviews_ColorScore",
                table: "BeerReviews");

            migrationBuilder.DropCheckConstraint(
                name: "CK_BeerReviews_SmellScore",
                table: "BeerReviews");

            migrationBuilder.DropCheckConstraint(
                name: "CK_BeerReviews_TasteScore",
                table: "BeerReviews");

            migrationBuilder.DropCheckConstraint(
                name: "CK_BeerReviews_TotalScore",
                table: "BeerReviews");

            migrationBuilder.DropColumn(
                name: "ColorScore",
                table: "BeerReviews");

            migrationBuilder.DropColumn(
                name: "SmellScore",
                table: "BeerReviews");

            migrationBuilder.DropColumn(
                name: "TasteScore",
                table: "BeerReviews");

            migrationBuilder.RenameColumn(
                name: "TotalScore",
                table: "BeerReviews",
                newName: "Rating");

            migrationBuilder.AddCheckConstraint(
                name: "CK_BeerReviews_Rating",
                table: "BeerReviews",
                sql: "[Rating] >= 1 AND [Rating] <= 6");
        }
    }
}
