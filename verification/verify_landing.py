from playwright.sync_api import sync_playwright

def verify_landing_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:3001")
            page.wait_for_load_state("networkidle")

            # Check for name input and join elements
            page.wait_for_selector("input[placeholder='Your Name']")
            page.wait_for_selector("button:has-text('Create New Meeting')")

            # Take screenshot of landing page
            page.screenshot(path="verification/landing_page_ui.png")
            print("Screenshot saved.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_landing_ui()
