from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("file:///app/index.html")

    # Define the container for the projects
    projects_container = page.locator("#projects .cards")

    # Scroll to the section to make sure it's loaded
    projects_container.scroll_into_view_if_needed()

    # Wait for the elements to be stable
    page.wait_for_timeout(1000)

    # Take a screenshot of just the project cards container
    projects_container.screenshot(path="jules-scratch/verification/projects_section.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)