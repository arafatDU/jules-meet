from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")

            # Fill name and create meeting
            page.fill("input[placeholder='Your Name']", "TestUser")
            page.click("button:has-text('Create New Meeting')")

            # Wait for meeting room to load
            page.wait_for_selector("text=Meeting Room:")

            # Take screenshot of meeting room
            page.screenshot(path="verification/meeting_room_ui.png")
            print("Screenshot saved.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_ui()
