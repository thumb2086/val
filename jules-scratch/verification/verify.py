from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8081")
    page.click("text=Weapons")
    page.wait_for_selector("text=Vandal")
    page.screenshot(path="jules-scratch/verification/screenshot.png")
    browser.close()