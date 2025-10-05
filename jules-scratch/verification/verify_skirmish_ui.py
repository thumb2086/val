from playwright.sync_api import sync_playwright, expect, Page
import time

# Generate a unique username for this run
unique_id = str(int(time.time()))
USERNAME = f"verifyuser_{unique_id}"
PASSWORD = "verifypassword"

def run_verification(page: Page):
    # Handle alerts (for registration success)
    page.on("dialog", lambda dialog: dialog.accept())

    print(f"Navigating to http://localhost:3000...")
    page.goto("http://localhost:3000", timeout=20000)

    # Register a new user
    print(f"Registering new user: {USERNAME}")
    page.locator("#register-tab").click()
    page.locator("#register-username").fill(USERNAME)
    page.locator("#register-password").fill(PASSWORD)
    page.locator("#register-btn").click()

    # Wait for the alert to be handled, then switch back to the login tab
    page.wait_for_timeout(1000) # Give dialog time to show and be dismissed
    print("Switching back to login tab...")
    page.locator("#login-tab").click()

    print(f"Logging in as {USERNAME}")
    page.locator("#login-username").fill(USERNAME)
    page.locator("#login-password").fill(PASSWORD)
    page.locator("#login-btn").click()

    # Wait for main menu and click multiplayer
    print("Navigating to multiplayer screen...")
    expect(page.locator("#main-menu-screen")).to_be_visible(timeout=15000)
    page.locator("#multiplayer-btn").click()

    # Wait for multiplayer screen
    expect(page.locator("#multiplayer-screen")).to_be_visible(timeout=10000)
    print("On multiplayer screen. Starting verification...")

    kill_limit_setting = page.locator("#kill-limit-setting")

    # --- Verify Deathmatch (default) ---
    print("Verifying Deathmatch mode (default)...")
    expect(kill_limit_setting).to_be_visible()
    print("OK: Kill limit is visible for Deathmatch.")

    # --- Verify 5v5 ---
    print("Verifying 5v5 mode...")
    page.locator('input[name="gameMode"][value="5v5"]').click()
    expect(kill_limit_setting).to_be_hidden()
    print("OK: Kill limit is hidden for 5v5.")

    # --- Verify Skirmish ---
    print("Verifying Skirmish mode...")
    page.locator('input[name="gameMode"][value="skirmish"]').click()
    expect(kill_limit_setting).to_be_hidden()
    print("OK: Kill limit is hidden for Skirmish.")

    # Take the final screenshot showing Skirmish selected and kill limit hidden
    print("Taking screenshot...")
    page.screenshot(path="jules-scratch/verification/verification.png")
    print("Screenshot saved to jules-scratch/verification/verification.png")


with sync_playwright() as p:
    browser = None
    try:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = browser.new_page()
        run_verification(page)
    except Exception as e:
        print(f"An error occurred during Playwright execution: {e}")
    finally:
        if browser:
            browser.close()