using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Olsmaking.Bff.Data;

namespace Olsmaking.Bff.Tests.Infrastructure;

internal sealed class OlsmakingApiFactory(bool auth0Configured) : WebApplicationFactory<Program>
{
    private SqliteConnection? _connection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", "Server=(localdb)\\mssqllocaldb;Database=olsmaking-tests;Trusted_Connection=True;");
        builder.UseSetting("Auth0:Domain", auth0Configured ? "test.auth0.local" : string.Empty);
        builder.UseSetting("Auth0:ClientId", auth0Configured ? "client-id" : string.Empty);
        builder.UseSetting("Auth0:ClientSecret", auth0Configured ? "client-secret" : string.Empty);
        builder.UseSetting("Auth0:Audience", "test-audience");
        builder.ConfigureAppConfiguration((_, configBuilder) =>
        {
            configBuilder.Sources.Clear();
            configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Server=(localdb)\\mssqllocaldb;Database=olsmaking-tests;Trusted_Connection=True;",
                ["Auth0:Domain"] = auth0Configured ? "test.auth0.local" : string.Empty,
                ["Auth0:ClientId"] = auth0Configured ? "client-id" : string.Empty,
                ["Auth0:ClientSecret"] = auth0Configured ? "client-secret" : string.Empty,
                ["Auth0:Audience"] = "test-audience",
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<OlsmakingDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<OlsmakingDbContext>>();
            services.RemoveAll<OlsmakingDbContext>();

            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            services.AddDbContext<OlsmakingDbContext>(options => options.UseSqlite(_connection));

            if (auth0Configured)
            {
                services
                    .AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                        options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                        options.DefaultScheme = TestAuthHandler.SchemeName;
                    })
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ =>
                    {
                    });
            }
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        using var scope = host.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<OlsmakingDbContext>();
        dbContext.Database.EnsureCreated();

        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing)
        {
            _connection?.Dispose();
            _connection = null;
        }
    }
}
