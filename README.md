# Company Portal

This project contains a simple web application that you can use to manage your small business activities. It is built using only HTML, CSS and vanilla JavaScript and stores data locally in your browser using `localStorage` — there is no server or database required. Because the data is stored in each user's browser, it will not sync automatically between devices. If you need to access the same data from multiple devices you would need to implement a server or cloud database, which is beyond the scope of this simple example.

## Features

- **Login page:** A basic username/password form.  The application seeds a single user (`admin` / `password`) on first use.  You can edit the `defaultUsers` array in `common.js` to add or change user accounts.  Authentication is entirely client‑side and should not be used for sensitive information.
- **Menu page:** Provides links to the four main functions and a logout button.
- **Boat/Trailer scheduling:** Add, view and delete scheduled moves.  Each entry includes a date, time, description and boat/trailer details.
- **Employee schedule:** Add, view and delete employee shifts.  Records include employee name, date, start/end time and optional notes.
- **Maintenance requests:** Add, view and delete maintenance items.  Each request stores a date, description and priority (Low/Medium/High).
- **Move outs:** Record, view and delete move-out events with occupant name, date and optional notes.

## How to use

1. **Unzip the project:** After downloading the ZIP archive, extract its contents to a folder on your computer.  All application files live in that folder.  Do not rename the files unless you also update the references inside the HTML pages.

2. **Open locally (for testing):** You can open `index.html` directly in your browser to test the application.

3. **Host on GitHub Pages:**
   * Create a new repository on your GitHub account (for example, `company‑portal`).
   * Add all files and commit them to the main branch.  If you are unfamiliar with Git, the simplest way is to use GitHub’s web interface to upload the files directly.
   * In the repository settings (⚙️ → **Pages**), choose the branch (e.g. `main`) and the folder (`/` root).  Save the settings and GitHub will deploy your site.
   * Visit the provided URL (something like `https://your‑username.github.io/company‑portal/`) to access the app.

4. **Customise users:** To change or add user accounts, edit the `defaultUsers` array in `common.js`.  Each entry requires a `username` and `password` property.  When no users exist in localStorage (first run), these defaults are copied into storage.

5. **Limitations:** This app stores all data in the browser’s `localStorage`. This means:
   * Data is tied to each device/browser — one user’s changes are not shared with others automatically.
   * Clearing the browser cache or running in incognito/private mode may remove your data.
   * For true multi‑user capability or data persistence across devices, you would need to integrate a backend service or database.

If you decide later that you need a more robust solution (for example, storing data in the cloud so multiple employees see the same schedules), you could look into free tiers of backend services like Firebase or Supabase.  Those services would require additional setup and code changes.

## Further reading

To learn more about deploying static sites, check out the following resources:

- [GitHub Pages documentation](https://docs.github.com/en/pages)

Feel free to explore the code and extend it to suit your business needs.  This project is intentionally kept straightforward to make it easy to understand and adapt.