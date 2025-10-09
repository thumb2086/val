import asyncio
from playwright.async_api import async_playwright, expect
import random
import string

def random_string(length=8):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Generate random user credentials
        username = random_string()
        password = "password"

        try:
            # Navigate to the game
            await page.goto("http://localhost:3000")

            # Go to register form
            await page.locator("#register-tab").click()
            await expect(page.locator("#register-form")).to_be_visible()

            # Register a new user
            await page.locator("#register-username").fill(username)
            await page.locator("#register-password").fill(password)
            await page.locator("#register-btn").click()

            # Handle the alert pop-up
            page.on("dialog", lambda dialog: dialog.accept())

            # Go to login form
            await page.locator("#login-tab").click()
            await expect(page.locator("#login-form")).to_be_visible()

            # Login
            await page.locator("#login-username").fill(username)
            await page.locator("#login-password").fill(password)
            await page.locator("#login-btn").click()

            # Wait for main menu
            await expect(page.locator("#main-menu-screen")).to_be_visible(timeout=10000)

            # Go to weapon skins screen
            await page.locator("#weapon-skins-btn").click()
            await expect(page.locator("#weapon-skins-screen")).to_be_visible()

            # Select the new Vandal skin
            await page.locator('button[data-weapon-id="vandal"][data-skin-index="4"]').click()

            # Close the skins menu
            await page.locator("#close-skins").click()
            await expect(page.locator("#main-menu-screen")).to_be_visible()

            # Start a practice match
            await page.locator("#target-practice-settings-btn").click()
            await expect(page.locator("#practice-settings-screen")).to_be_visible()
            await page.locator("#start-practice-btn").click()

            # Wait for the game to load and take a screenshot
            await page.wait_for_timeout(3000) # Wait for canvas to be active
            await page.screenshot(path="jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An error occurred: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())