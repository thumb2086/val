from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Navigate to the local development server
        page.goto("http://localhost:8080")

        # Wait for the auth screen to be visible
        page.wait_for_selector("#auth-screen", state="visible", timeout=30000)
        print("Auth screen is visible.")

        # Perform login
        page.fill("#login-username", "testuser")
        page.fill("#login-password", "password")
        page.click("#login-btn")
        print("Login submitted.")

        # Wait for the main menu to appear
        page.wait_for_selector("#main-menu-screen", state="visible", timeout=30000)
        print("Main menu is visible.")

        # Click the weapon skins button
        page.click("#weapon-skins-btn")
        page.wait_for_selector("#weapon-skins-screen", state="visible", timeout=30000)
        print("Weapon skins screen is visible.")

        # Select the new Sakura Vandal skin
        page.click('button[data-weapon-id="vandal"][data-skin-index="3"]')
        print("Sakura Vandal skin selected.")

        # Go back to the main menu
        page.click("#close-skins")
        page.wait_for_selector("#main-menu-screen", state="visible", timeout=30000)
        print("Returned to main menu.")

        # Start a practice game to see the UI
        page.click("#target-practice-settings-btn")
        page.wait_for_selector("#practice-settings-screen", state="visible", timeout=30000)
        print("Practice settings screen is visible.")
        page.click("#start-practice-btn")
        print("Starting practice game.")

        # Wait for the in-game UI to be visible
        page.wait_for_selector("#ammo-display", state="visible", timeout=30000)
        page.wait_for_selector("#weapon-info-display", state="visible", timeout=30000)
        print("In-game UI is visible.")

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/weapon_ui_verification.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as p:
    run(p)